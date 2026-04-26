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
} from "@oh-pen-testing/core";
import {
  createGitHubAdapter,
  resolveGitHubToken,
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
   *   completed   — fully done; check `summary` and (optional) `autoRemediation`
   *   failed      — scan itself errored; check `error`
   */
  status: "running" | "remediating" | "completed" | "failed";
  /** Populated once status === "completed". */
  summary?: ActiveScanSummary;
  /** Populated once status === "failed". */
  error?: string;
  /**
   * Populated when status === "remediating" or "completed" AND the
   * user's autonomy mode kicked off auto-remediation. Absent in
   * careful / recommended modes.
   */
  autoRemediation?: AutoRemediationResult;
}

// Module singleton. Intentionally a wrapper object so we can mutate
// in place (the state object reference stays stable across reads).
const state: { current: ActiveScanState | null } = { current: null };

export function getActiveScan(): ActiveScanState | null {
  return state.current;
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
  };
  state.current = entry;
  // Fire-and-forget — Node keeps this promise alive in module scope.
  void runScanAndMaybeRemediate(entry, "starter");
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
  };
  state.current = entry;
  void runScanAndMaybeRemediate(entry, "full");
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
): Promise<void> {
  let config: Config;
  try {
    ensureProvidersRegistered();
    const cwd = await resolveScanTargetPath();
    config = await loadConfig(cwd);
    const provider = await resolveProvider({ config });

    const scanResult =
      kind === "starter"
        ? await runScan({
            cwd,
            config,
            provider,
            playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
            onlyPlaybookIds: [...STARTER_PLAYBOOK_IDS],
            skipAiConfirm: true,
          })
        : await runScan({
            cwd,
            config,
            provider,
            playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
          });

    entry.summary = summariseScan(scanResult, config.agents.autonomy);

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
    // Hand a real file-logger to the agent pool so every failure
    // mode lands in .ohpentesting/logs/<scanId>.jsonl. The user can
    // grep that file when something fails — gives us the full error
    // including stack-relevant context that doesn't fit in the UI.
    const logger = await createLogger(cwd, scanResult.scanId);
    try {
      entry.autoRemediation = await runAutoRemediation(cwd, config, logger);
    } finally {
      await logger.close();
    }
    entry.status = "completed";
  } catch (err) {
    entry.error = (err as Error).message ?? "Unknown scan error";
    entry.status = "failed";
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
  // Parallelism forced to 1 here. The default agent pool runs up to
  // 4 agents in parallel, but they all share the same cwd /
  // working-tree, which leads to race conditions: agent A modifies
  // file X, agent B does `git checkout -b new-branch` (which fails
  // because the working tree is dirty), or agent A's `git add .`
  // sweeps up agent B's in-flight changes into A's commit. The
  // result is the systemic 100%-failure pattern we saw in
  // production. Until we move each agent into its own git worktree,
  // serialisation is the only safe option.
  const result = await runAgentPool({
    cwd,
    config,
    provider,
    adapter,
    playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
    filter: (_issue: Issue) => true,
    parallelism: 1,
    logger,
    onProgress: (event) => {
      // Mirror progress events into the log for after-the-fact
      // analysis — gives us a full ordered transcript of what each
      // agent did per issue.
      logger.info(`agent_pool.${event.type}`, event);
    },
  });

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
    detail =
      "Nothing to remediate — no open issues at backlog/ready. (Issues already in_review or done aren't re-PR'd.)";
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
    detail =
      parts.length > 0
        ? parts.join(" · ") + "."
        : "No PRs opened — every issue was either gated or failed.";
  }

  return {
    ok: completedCount > 0 || (attempted === 0),
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
  };
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
    autonomy,
    topFiles,
    yoloMode: autonomy === "yolo" || autonomy === "full-yolo",
  };
}
