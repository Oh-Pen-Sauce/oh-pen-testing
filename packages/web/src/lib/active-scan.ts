/**
 * Process-level active-scan registry.
 *
 * Scans are kicked off as fire-and-forget background promises that
 * outlive the request that started them. Without this, a user who
 * starts a scan and then navigates away loses all progress — the
 * server-action promise resolves to nothing because the client moved
 * on.
 *
 * The state lives in module scope so it survives across requests
 * within the same Node process. In dev (Next's hot reload) it CAN
 * get reset on file change; that's fine — the user reloads anyway.
 * In prod it persists for the lifetime of the server.
 *
 * We track only ONE active scan at a time. If the user kicks off a
 * full scan while a starter is still running, we just refuse and
 * return the existing one. Two parallel scans would chew on the same
 * filesystem and fight over the issues directory — not a useful
 * thing to support.
 *
 * ## Auto-remediate-after-scan (YOLO/full-YOLO only)
 *
 * When the user's autonomy is "yolo" or "full-yolo", the scan
 * promise CONTINUES past the scan itself into a remediation pass —
 * walking every backlog/ready issue (including ones from prior scans)
 * and opening PRs through the agent pool. Status flow:
 *
 *   running → remediating → completed
 *
 * The `autoRemediation` field on the entry is populated with the
 * pool's result (PR URLs, gated, failed) once the remediation step
 * finishes. In careful/recommended modes this whole step is skipped
 * — the scan just finishes at "completed" and the user has to either
 * triage manually or click the "auto-remediate all" button.
 *
 * The reason this lives inside the scan promise (rather than as a
 * separate trigger) is that the user's mental model of YOLO is "do
 * the thing without asking me". Requiring a separate button click
 * defeats the autonomy mode.
 */
import {
  loadConfig,
  STARTER_PLAYBOOK_IDS,
  createLogger,
  type Config,
  type Issue,
  type Logger,
} from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import {
  resolveProvider,
  runScan,
  runAgentPool,
  ScanCancelled,
} from "@oh-pen-testing/core";
import {
  createGitHubAdapter,
  resolveGitHubToken,
  addWorktree,
  removeWorktree,
} from "@oh-pen-testing/git-github";
import { resolveScanTargetPath } from "./ohpen-cwd";
import { ensureProvidersRegistered } from "./providers-bootstrap";

export type ActiveScanKind = "starter" | "full";

/**
 * Mirror of StarterScanSummary defined in ../app/scans/actions.ts —
 * duplicated here to keep this lib free of UI-package imports. The
 * shape stays identical so the wire format is uniform.
 */
export interface ActiveScanSummary {
  ok: true;
  scanId: string;
  issuesFound: number;
  filesScanned: number;
  scannedPath: string;
  playbooksRun: number;
  /**
   * Total playbooks in the bundled catalog. Surfaced as "10 of 31"
   * so users understand WHY only some ran (the rest don't apply to
   * their stack — Python playbooks vs a TS project, etc).
   */
  playbooksAvailable: number;
  /** Playbooks skipped because their `languages` didn't match. */
  playbooksFilteredByLanguage: number;
  autonomy: string;
  topFiles: string[];
  yoloMode: boolean;
}

/**
 * Result of the auto-remediation pass that follows a scan in YOLO
 * mode. Mirrors the shape of AutoRemediateResult in remediate-actions
 * so the UI can render either flavour identically.
 */
export interface AutoRemediationResult {
  ok: boolean;
  /** Human-readable summary for the UI banner. */
  detail: string;
  prUrls: string[];
  gated: Array<{ issueId: string; reason: string }>;
  failed: Array<{ issueId: string; error: string }>;
  /** Number of issues the pool actually attempted (post-filter). */
  attempted: number;
  /** ISO timestamp when the remediation step finished. */
  finishedAt: string;
  /** True when the pool stopped early because the user clicked stop. */
  cancelled?: boolean;
  /** Issue IDs left untouched at cancellation time. */
  skipped?: string[];
}

/**
 * Live event the UI streams during a scan/remediation run. The
 * server keeps the last MAX_EVENTS in-memory; the UI polls the
 * active-scan state and renders the events as a scrolling log so
 * the user can see playbooks running, issues being created, agents
 * picking up work, and errors as they happen — instead of staring
 * at a spinner for 11 minutes hoping something's actually
 * happening.
 */
export interface ProgressEvent {
  /** ISO timestamp; used to display "12s ago" relative to now. */
  ts: string;
  level: "info" | "warn" | "error";
  /** Tag from the underlying logger (e.g. "agent_pool.completed"). */
  category: string;
  /** Human-readable summary line — pre-formatted, ready to render. */
  message: string;
}

export interface ActiveScanState {
  /** Stable id for this run — useful for the UI to detect "new run". */
  id: string;
  kind: ActiveScanKind;
  /** epoch ms when the scan was kicked off. */
  startedAt: number;
  /**
   * Lifecycle:
   *   running     — scan is in flight
   *   remediating — scan finished, agent pool is opening PRs (YOLO only)
   *   stopping    — user clicked stop; runners will halt at next checkpoint
   *   completed   — fully done; check `summary` and (optional) `autoRemediation`
   *   failed      — scan itself errored; check `error`
   *   cancelled   — user-stopped, partial results in `summary` /
   *                `autoRemediation`. Issues already created stay on
   *                the board, PRs already opened stay open.
   */
  status:
    | "running"
    | "remediating"
    | "stopping"
    | "completed"
    | "failed"
    | "cancelled";
  /** Populated once status === "completed" or "cancelled" (partial). */
  summary?: ActiveScanSummary;
  /** Populated once status === "failed". */
  error?: string;
  /**
   * Populated when status === "remediating" or "completed" AND the
   * user's autonomy mode kicked off auto-remediation. Absent in
   * careful / recommended modes.
   */
  autoRemediation?: AutoRemediationResult;
  /**
   * Last MAX_EVENTS progress events from the run. Capped + truncated
   * from the front when overflowing to bound memory and the
   * polling-payload size. Empty until logger emits something.
   */
  events: ProgressEvent[];
}

/** Cap on event-buffer size. ~200 events × ~120 bytes = ~24KB max payload. */
const MAX_EVENTS = 200;

// Module singleton. Intentionally a wrapper object so we can mutate
// in place (the state object reference stays stable across reads).
const state: { current: ActiveScanState | null } = { current: null };

/**
 * Internal companion to `state.current`. Holds the AbortController
 * for the in-flight scan promise. NOT serialised to the client —
 * the controller can't cross the wire, and the client only needs
 * to know "can I cancel?" (yes if status is running/remediating).
 *
 * Lives in a wrapper object so we can null it out when a run
 * finishes without disturbing `state.current`.
 */
const internal: { controller: AbortController | null } = { controller: null };

export function getActiveScan(): ActiveScanState | null {
  return state.current;
}

/**
 * Abort the currently-running scan, if any. Cooperative — runners
 * check the signal at safe checkpoints and unwind cleanly. Status
 * flips to "stopping" immediately; the runners promote it to
 * "cancelled" once they actually halt (could take seconds for an
 * in-flight AI call to finish).
 *
 * No-op if nothing is in flight, or if the scan has already
 * transitioned past the running/remediating phases.
 */
export function abortActiveScan(): { aborted: boolean; reason?: string } {
  if (!state.current) {
    return { aborted: false, reason: "no active scan" };
  }
  if (
    state.current.status !== "running" &&
    state.current.status !== "remediating"
  ) {
    return {
      aborted: false,
      reason: `scan is in status '${state.current.status}', already past the cancellable phase`,
    };
  }
  state.current.status = "stopping";
  internal.controller?.abort(new Error("user requested stop"));
  return { aborted: true };
}

export function clearActiveScan(): void {
  // Don't clear if a scan or remediation is mid-flight — that would
  // leave the bg promise updating a detached object, and the UI
  // would think there's no scan when there really is.
  if (
    state.current?.status !== "running" &&
    state.current?.status !== "remediating"
  ) {
    state.current = null;
  }
}

/**
 * Start a starter scan in the background. If one is already running
 * (any kind), returns the existing entry instead of starting a new
 * one — the UI should poll its status.
 */
export function startStarterScanInBackground(): ActiveScanState {
  if (
    state.current?.status === "running" ||
    state.current?.status === "remediating"
  ) {
    return state.current;
  }
  const entry: ActiveScanState = {
    id: `bg-${Date.now().toString(36)}`,
    kind: "starter",
    startedAt: Date.now(),
    status: "running",
    events: [],
  };
  state.current = entry;
  internal.controller = new AbortController();
  // Fire-and-forget — Node keeps this promise alive in module scope.
  void runScanAndMaybeRemediate(entry, "starter", internal.controller.signal);
  return entry;
}

/**
 * Start a full-catalog scan in the background. Same one-at-a-time
 * semantics as starter.
 */
export function startFullScanInBackground(): ActiveScanState {
  if (
    state.current?.status === "running" ||
    state.current?.status === "remediating"
  ) {
    return state.current;
  }
  const entry: ActiveScanState = {
    id: `bg-${Date.now().toString(36)}`,
    kind: "full",
    startedAt: Date.now(),
    status: "running",
    events: [],
  };
  state.current = entry;
  internal.controller = new AbortController();
  void runScanAndMaybeRemediate(entry, "full", internal.controller.signal);
  return entry;
}

// ───────── internal runners ─────────

/**
 * Single fused pipeline: scan → (in YOLO) auto-remediate. Status
 * transitions in place on the entry so polling clients see each
 * phase as it happens.
 */
async function runScanAndMaybeRemediate(
  entry: ActiveScanState,
  kind: ActiveScanKind,
  signal: AbortSignal,
): Promise<void> {
  let config: Config;
  let cwd: string;
  // Build the streaming logger early so even pre-scan errors land in
  // entry.events. The file-logger itself can't be created until we
  // know the scanId, so this starts as a noop wrapper and gets
  // upgraded once runScan returns.
  let fileLogger: Logger | null = null;
  const streamingLogger = makeStreamingLogger(entry, () => fileLogger);
  try {
    ensureProvidersRegistered();
    cwd = await resolveScanTargetPath();
    config = await loadConfig(cwd);
    const provider = await resolveProvider({ config });

    streamingLogger.info("active_scan.dispatch", {
      kind,
      autonomy: config.agents.autonomy,
      cwd,
    });

    const scanResult =
      kind === "starter"
        ? await runScan({
            cwd,
            config,
            provider,
            playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
            onlyPlaybookIds: [...STARTER_PLAYBOOK_IDS],
            skipAiConfirm: true,
            logger: streamingLogger,
            signal,
          })
        : await runScan({
            cwd,
            config,
            provider,
            playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
            logger: streamingLogger,
            signal,
          });

    entry.summary = summariseScan(scanResult, config.agents.autonomy);
    streamingLogger.info("active_scan.scan_complete", {
      scanId: scanResult.scanId,
      issuesFound: scanResult.issues.length,
    });

    // After the scan completes, the user may have cancelled before
    // we move into remediation. Honour it — they don't want PRs to
    // start opening if they hit stop. (If they hit stop AFTER
    // remediation started, the agent pool's own signal check
    // handles it.)
    if (signal.aborted) {
      streamingLogger.info("active_scan.cancelled_before_remediate", {
        scanId: scanResult.scanId,
      });
      entry.status = "cancelled";
      return;
    }

    const isYolo =
      config.agents.autonomy === "yolo" ||
      config.agents.autonomy === "full-yolo";

    if (!isYolo) {
      // Non-YOLO modes stop here. User can manually trigger
      // auto-remediate or triage on the board.
      entry.status = "completed";
      return;
    }

    // ── Auto-remediation pass (YOLO/full-YOLO) ──
    entry.status = "remediating";
    // Now that we have a scanId, attach the file logger so events
    // also land in .ohpentesting/logs/<scanId>.jsonl alongside the
    // in-memory ring buffer. Both surfaces stay in sync.
    fileLogger = await createLogger(cwd, scanResult.scanId);
    try {
      entry.autoRemediation = await runAutoRemediation(
        cwd,
        config,
        streamingLogger,
        signal,
      );
    } finally {
      await fileLogger.close();
      fileLogger = null;
    }
    // If the agent pool reported cancellation, surface that as the
    // top-level status. Otherwise, completed.
    entry.status = entry.autoRemediation?.cancelled ? "cancelled" : "completed";
  } catch (err) {
    if (err instanceof ScanCancelled) {
      // Cancellation thrown from inside runScan — treat as expected.
      streamingLogger.info("active_scan.scan_cancelled", {
        scanId: err.scanId,
      });
      entry.status = "cancelled";
      return;
    }
    streamingLogger.error("active_scan.fatal", {
      error: (err as Error).message,
    });
    entry.error = (err as Error).message ?? "Unknown scan error";
    entry.status = "failed";
  } finally {
    // Clear the controller — the run is done one way or another,
    // and a future scan will create a fresh one.
    internal.controller = null;
  }
}

/**
 * Walks every backlog/ready issue through the agent pool, opening
 * PRs as it goes. Returns a summary the UI can render.
 *
 * Handles the two common "I'm in YOLO but nothing happens" failure
 * modes explicitly:
 *   - No GitHub token configured (wizard step skipped, env var
 *     unset)
 *   - No PR target repo configured (still on placeholder)
 * Both produce a loud, actionable AutoRemediationResult instead of
 * silently doing nothing.
 */
async function runAutoRemediation(
  cwd: string,
  config: Config,
  logger: Logger,
  signal: AbortSignal,
): Promise<AutoRemediationResult> {
  const finishedAt = () => new Date().toISOString();
  logger.info("auto_remediate.start", {
    autonomy: config.agents.autonomy,
    repo: config.git.repo,
    cwd,
  });

  const token = await resolveGitHubToken();
  if (!token) {
    logger.warn("auto_remediate.no_token");
    return {
      ok: false,
      detail:
        "YOLO auto-remediation skipped: no GitHub token. Finish the wizard's GitHub step (or export GITHUB_TOKEN) so PRs can actually be opened.",
      prUrls: [],
      gated: [],
      failed: [],
      attempted: 0,
      finishedAt: finishedAt(),
    };
  }
  if (!config.git.repo || config.git.repo === "owner/name") {
    logger.warn("auto_remediate.no_repo");
    return {
      ok: false,
      detail:
        "YOLO auto-remediation skipped: PR target repo not set (still 'owner/name'). Finish the GitHub step in /setup so I know where to open PRs.",
      prUrls: [],
      gated: [],
      failed: [],
      attempted: 0,
      finishedAt: finishedAt(),
    };
  }

  const provider = await resolveProvider({ config });
  const adapter = createGitHubAdapter({
    token,
    repo: config.git.repo,
    defaultBranch: config.git.default_branch,
  });

  // No severity filter — YOLO means "fix everything". The agent's
  // own autonomy gate decides whether each individual issue gets a
  // PR or gets bucketed to "gated".
  //
  // Parallelism: respect the user's `config.agents.parallelism`
  // setting (default 4). Each parallel agent slot gets its own git
  // worktree at `<cwd>-wt<N>` so they can write files / create
  // branches / commit independently — without the working-tree
  // races that forced parallelism=1 in the prior implementation.
  // Worktrees share refs via the parent's .git directory, so
  // branches are visible across all of them; HEADs are independent.
  const parallelism = Math.max(1, config.agents.parallelism);
  const worktreeDirs: string[] = [];
  // Slot 0 always uses the main cwd. Slots 1..N-1 each get their
  // own worktree. Set up additive workdirs only when parallelism > 1
  // — single-agent runs avoid the disk footprint and setup cost.
  if (parallelism > 1) {
    for (let i = 1; i < parallelism; i++) {
      const wt = `${cwd}-wt${i}`;
      try {
        await addWorktree(cwd, wt, config.git.default_branch);
        worktreeDirs.push(wt);
        logger.info("agent_pool.worktree_created", {
          slot: i,
          path: wt,
        });
      } catch (err) {
        // If we can't create a worktree (disk full, permission
        // issue, leftover state from a crash), fall back to
        // serialised single-agent mode rather than failing the
        // whole remediation. The user gets slower-but-working.
        logger.warn("agent_pool.worktree_create_failed", {
          slot: i,
          error: (err as Error).message,
        });
      }
    }
  }
  // Effective parallelism = main slot + however many worktrees we
  // actually got. If all worktree creates failed, we fall back to 1.
  const effectiveParallelism = 1 + worktreeDirs.length;
  if (effectiveParallelism < parallelism) {
    logger.warn("agent_pool.parallelism_reduced", {
      requested: parallelism,
      effective: effectiveParallelism,
    });
  }

  let result;
  try {
    result = await runAgentPool({
      cwd,
      config,
      provider,
      adapter,
      playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
      filter: (_issue: Issue) => true,
      parallelism: effectiveParallelism,
      // Slot 0 → cwd. Slots 1..N → matching worktree dir.
      repoPathForAgent: (idx) =>
        idx === 0 ? cwd : (worktreeDirs[idx - 1] ?? cwd),
      logger,
      signal,
      onProgress: (event) => {
        // Mirror progress events into the log for after-the-fact
        // analysis — gives us a full ordered transcript of what each
        // agent did per issue.
        logger.info(`agent_pool.${event.type}`, event);
      },
    });
  } finally {
    // Always tear down worktrees, even if the pool errored. They
    // share refs with the main repo, so leaving them behind would
    // accumulate disk + leak old `ohpen/...` branch checkouts.
    for (const wt of worktreeDirs) {
      try {
        await removeWorktree(cwd, wt);
        logger.info("agent_pool.worktree_removed", { path: wt });
      } catch (err) {
        logger.warn("agent_pool.worktree_remove_failed", {
          path: wt,
          error: (err as Error).message,
        });
      }
    }
  }

  const prUrls = result.completed
    .map((c) => c.prUrl)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  const completedCount = result.completed.length;
  const gatedCount = result.gated.length;
  const failedCount = result.failed.length;
  const attempted = completedCount + gatedCount + failedCount;

  logger.info("auto_remediate.done", {
    completed: completedCount,
    gated: gatedCount,
    failed: failedCount,
  });

  let detail: string;
  if (attempted === 0) {
    detail = result.cancelled
      ? `Stopped before any issue was attempted. ${result.skipped?.length ?? 0} issues left at backlog/ready for a future run.`
      : "Nothing to remediate — no open issues at backlog/ready. (Issues already in_review or done aren't re-PR'd.)";
  } else {
    const parts: string[] = [];
    if (completedCount > 0) {
      parts.push(`${completedCount} PR${completedCount === 1 ? "" : "s"} opened`);
    }
    if (gatedCount > 0) {
      parts.push(`${gatedCount} gated for approval`);
    }
    if (failedCount > 0) {
      parts.push(`${failedCount} failed`);
    }
    if (result.cancelled && result.skipped && result.skipped.length > 0) {
      parts.push(`${result.skipped.length} skipped (you stopped the run)`);
    }
    detail =
      parts.length > 0
        ? parts.join(" · ") + "."
        : "No PRs opened — every issue was either gated or failed.";
  }

  return {
    ok: completedCount > 0 || (attempted === 0 && !result.cancelled),
    detail,
    prUrls,
    gated: result.gated.map((g) => ({
      issueId: g.issueId,
      reason: g.reason,
    })),
    failed: result.failed.map((f) => ({
      issueId: f.issueId,
      error: f.error,
    })),
    attempted,
    finishedAt: finishedAt(),
    cancelled: result.cancelled,
    skipped: result.skipped,
  };
}

/**
 * Wrap a (possibly absent) file logger so every event ALSO appends
 * to the active-scan entry's events ring buffer, AFTER being passed
 * through formatProgressEvent() to produce a UI-ready string.
 *
 * The fileLogger is a thunk-getter rather than a fixed reference
 * because we don't always have one — pre-scan we can't know the
 * scan id, and during scan we want everything streamed; the file
 * logger gets attached only once auto-remediation begins. The
 * thunk lets the upgrade happen in-place without rebuilding the
 * wrapper.
 */
function makeStreamingLogger(
  entry: ActiveScanState,
  getFileLogger: () => Logger | null,
): Logger {
  function append(
    level: "info" | "warn" | "error",
    event: string,
    data?: Record<string, unknown>,
  ) {
    // 1. Append to the in-memory ring buffer the UI polls.
    const message = formatProgressEvent(event, data);
    if (message) {
      entry.events.push({
        ts: new Date().toISOString(),
        level,
        category: event,
        message,
      });
      if (entry.events.length > MAX_EVENTS) {
        // Drop oldest when full. Splice modifies in place so the
        // outer reference stays stable for polling.
        entry.events.splice(0, entry.events.length - MAX_EVENTS);
      }
    }
    // 2. Forward to the file logger if one's currently attached.
    const fl = getFileLogger();
    if (fl) {
      if (level === "info") fl.info(event, data);
      else if (level === "warn") fl.warn(event, data);
      else fl.error(event, data);
    }
  }
  return {
    debug: () => {
      // Debug events skip both surfaces — too noisy for the UI ring.
    },
    info: (event, data) => append("info", event, data),
    warn: (event, data) => append("warn", event, data),
    error: (event, data) => append("error", event, data),
    close: async () => {
      // The file logger's close is owned by the caller (see
      // runScanAndMaybeRemediate's finally block) so we do nothing
      // here — closing twice would be a bug.
    },
  };
}

/**
 * Translate a structured logger event into a single human-readable
 * line for the progress log. Returns null for events the UI
 * doesn't need to surface (pure debug/internal noise) — those are
 * dropped from the ring buffer.
 */
function formatProgressEvent(
  event: string,
  data?: Record<string, unknown>,
): string | null {
  const d = (data ?? {}) as Record<string, string | number | undefined>;
  const cap = (s: string | undefined) =>
    typeof s === "string" && s.length > 0
      ? s[0]!.toUpperCase() + s.slice(1)
      : (s ?? "?");
  const emoji = (agentId: string | undefined) => {
    switch (agentId) {
      case "marinara":
        return "🍅";
      case "carbonara":
        return "🥓";
      case "alfredo":
        return "🧀";
      case "pesto":
        return "🌿";
      case "nonna":
        return "👵";
      default:
        return "•";
    }
  };

  switch (event) {
    case "active_scan.dispatch":
      return `📋 ${cap(String(d.kind ?? ""))} scan dispatching (autonomy: ${d.autonomy})`;
    case "active_scan.scan_complete":
      return `✓ Scan complete — ${d.issuesFound} issue${d.issuesFound === 1 ? "" : "s"} found (${d.scanId})`;
    case "active_scan.fatal":
      return `✖ Scan run errored: ${d.error}`;

    case "scan.start":
      return `▶ Scan ${d.scanId} starting (provider: ${d.provider})`;
    case "scan.playbooks_loaded":
      return `📚 Loaded ${d.relevant ?? d.total}/${d.total} playbooks`;
    case "scan.files_walked":
      return `🗂  Walked ${d.count} source files`;
    case "scan.cross_scan_dedup_seeded":
      return d.existingIssues && Number(d.existingIssues) > 0
        ? `↻ Cross-scan dedup primed with ${d.existingIssues} existing issue${d.existingIssues === 1 ? "" : "s"}`
        : null;
    case "scan.cross_scan_dedup_failed":
      return `⚠ Dedup priming failed: ${d.error}`;

    case "playbook.candidates":
      return Number(d.count) > 0
        ? `🔎 ${d.playbookId} — ${d.count} candidate${d.count === 1 ? "" : "s"}`
        : null; // skip "0 candidates" — too noisy
    case "playbook.sca":
      return `📦 ${d.playbookId} — ${d.findings} vulnerable package${d.findings === 1 ? "" : "s"}`;
    case "playbook.sca_failed":
      return `✖ SCA playbook failed (${d.playbookId}): ${d.error}`;

    case "issue.created":
      return `   • ${d.issueId} created — ${d.severity} in ${d.file}`;
    case "issue.deduped":
      return null; // not user-facing

    case "auto_remediate.start":
      return `🚀 Auto-remediation starting (${d.autonomy} mode, repo: ${d.repo})`;
    case "auto_remediate.no_token":
      return `⚠ Auto-remediation skipped — no GitHub token configured`;
    case "auto_remediate.no_repo":
      return `⚠ Auto-remediation skipped — PR target repo not set`;
    case "auto_remediate.done":
      return `🏁 Auto-remediation done — ${d.completed} PR${d.completed === 1 ? "" : "s"}, ${d.gated} gated, ${d.failed} failed`;

    case "agent_pool.assigned":
      return `${emoji(String(d.agent))} ${cap(String(d.agent))} picked up ${d.issueId}`;
    case "agent_pool.completed":
      return `✓ ${cap(String(d.agent))} opened PR for ${d.issueId}`;
    case "agent_pool.gated":
      return `⏸ ${cap(String(d.agent))} gated ${d.issueId}: ${d.reason}`;
    case "agent_pool.failed":
      return `✖ ${cap(String(d.agent))} failed on ${d.issueId}: ${d.error}`;

    case "agent.pickup":
      return null; // duplicate of agent_pool.assigned
    case "agent.gated":
      return null; // duplicate of agent_pool.gated
    case "agent.remediation_received":
      return `   AI patch received for ${d.issue}`;
    case "agent.remediation_received_retry":
      return `   AI patch received for ${d.issue} (Nonna's retry)`;
    case "agent.review_rejected_retrying":
      return `👵 Sent back: ${d.feedback}`;
    case "agent.pr_opened":
      return null; // duplicate of agent_pool.completed

    case "review.approved":
      return `👵 Approved ${cap(String(d.worker))}'s patch for ${d.issue}`;
    case "review.rejected":
      return `👵 Rejected ${cap(String(d.worker))}'s patch for ${d.issue}: ${d.feedback}`;
    case "review.fast_reject":
      return `👵 No-op patch rejected without an AI call (${d.issue})`;
    case "review.error_fail_open":
      return `⚠ Review errored — failing open for ${d.issue}: ${d.error}`;

    case "pool.start":
      return `🍝 Agent pool starting — ${d.total} eligible issue${d.total === 1 ? "" : "s"}, parallelism ${d.parallelism}`;
    case "pool.complete":
      return null; // duplicate of auto_remediate.done

    default:
      return null; // unknown event → drop (don't pollute the ring)
  }
}

// Shape mirror — keeps UI/wire format identical to runStarterScanAction.
function summariseScan(
  result: Awaited<ReturnType<typeof runScan>>,
  autonomy: string,
): ActiveScanSummary {
  const fileCounts = new Map<string, number>();
  for (const issue of result.issues) {
    const f = issue.location.file;
    fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1);
  }
  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);
  return {
    ok: true,
    scanId: result.scanId,
    issuesFound: result.issues.length,
    filesScanned: result.filesScanned,
    scannedPath: result.scannedPath,
    playbooksRun: result.scan.playbooks_run,
    playbooksAvailable: result.playbooksAvailable,
    playbooksFilteredByLanguage: result.playbooksFilteredByLanguage,
    autonomy,
    topFiles,
    yoloMode: autonomy === "yolo" || autonomy === "full-yolo",
  };
}
