"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Btn } from "../../components/trattoria/button";
import { CookingMarinara } from "./cooking-marinara";
import {
  startStarterScanInBackgroundAction,
  startFullScanInBackgroundAction,
  getActiveScanAction,
  clearActiveScanAction,
  abortActiveScanAction,
  bypassStarterAction,
} from "./actions";
import {
  runAutoRemediateAction,
  type AutoRemediateResult,
} from "./remediate-actions";
import type {
  ActiveScanState,
  AutoRemediationResult,
} from "../../lib/active-scan";
import { ProgressLog } from "./progress-log";

/**
 * Single source of truth on /scans for "is a scan happening?" and
 * "what was the result of the last one?".
 *
 * Polls `getActiveScanAction()` every 1.5s. The active-scan state
 * lives on the server (process-singleton), so even if the user
 * navigates to /board mid-scan and comes back, this re-mounts and
 * picks up exactly where the scan is.
 *
 * Three visual modes, picked from active.status:
 *   - null  → idle. Show "Run starter" (if starterComplete=false)
 *             or "Run full scan" (if starterComplete=true).
 *   - running → cooking marinara + elapsed timer + slow-scan hint.
 *   - completed → DoneCard with summary, full-scan button (if it was
 *                a starter), auto-remediate (if YOLO + issues),
 *                board link, dismiss-to-clear.
 *   - failed → red error panel + retry.
 *
 * The dismiss action calls clearActiveScanAction(); we then re-render
 * as idle. Until the user dismisses, the result panel persists across
 * navigation — which is the whole point.
 */
export function ActiveScanCard({
  starterComplete,
  startersDetail,
  initialActive,
}: {
  starterComplete: boolean;
  startersDetail: Array<{ id: string; displayName: string; description: string }>;
  /** Server-rendered initial state to avoid a flash of "no scan". */
  initialActive: ActiveScanState | null;
}) {
  const [active, setActive] = useState<ActiveScanState | null>(initialActive);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Auto-remediate is independent of the scan run — a YOLO user can
  // kick it off after seeing scan results, and we want them to be
  // able to keep watching its progress without losing the scan
  // summary.
  const [remediating, setRemediating] = useState(false);
  const [remediateResult, setRemediateResult] =
    useState<AutoRemediateResult | null>(null);

  // Poll active-scan status. Faster cadence while running OR
  // remediating so the phase-flip from scan→remediate→done feels
  // snappy. Even faster while "stopping" so the cancelled state
  // appears as soon as runners actually halt.
  useEffect(() => {
    const isLive =
      active?.status === "running" || active?.status === "remediating";
    const isStopping = active?.status === "stopping";
    const intervalMs = isStopping ? 800 : isLive ? 1500 : 4000;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await getActiveScanAction();
        if (!cancelled) setActive(next);
      } catch {
        /* network blip — keep last state */
      }
    };
    const handle = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [active?.status]);

  /**
   * Stop-cooking handler. Confirms with the user (a 10-minute scan
   * isn't easy to recreate), then fires the abort action. Server
   * flips status to "stopping" immediately; runners promote it to
   * "cancelled" at the next checkpoint. We don't wait — the polling
   * loop will pick up the state change.
   */
  async function stopCooking() {
    if (!active) return;
    const phase = active.status === "remediating" ? "remediation" : "scan";
    const ok = confirm(
      `Stop the ${phase}? Anything already done is kept (issues found, PRs opened) — only future work is skipped. The current AI call (if any) finishes first, so the actual halt may take a few seconds.`,
    );
    if (!ok) return;
    setActionError(null);
    try {
      const res = await abortActiveScanAction();
      if (!res.aborted) {
        setActionError(`Couldn't stop: ${res.reason ?? "unknown"}`);
      }
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function startStarter() {
    setActionError(null);
    setActionPending(true);
    try {
      const next = await startStarterScanInBackgroundAction();
      setActive(next);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionPending(false);
    }
  }

  async function startFull() {
    setActionError(null);
    setActionPending(true);
    setRemediateResult(null);
    try {
      const next = await startFullScanInBackgroundAction();
      setActive(next);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionPending(false);
    }
  }

  async function dismiss() {
    setActionError(null);
    setRemediateResult(null);
    await clearActiveScanAction();
    setActive(null);
  }

  async function bypass() {
    if (
      !confirm(
        "Skip the starter scan? You'll go straight to the full catalog. You can always come back.",
      )
    ) {
      return;
    }
    setActionPending(true);
    try {
      await bypassStarterAction();
      window.location.reload();
    } catch (err) {
      setActionError((err as Error).message);
      setActionPending(false);
    }
  }

  async function autoRemediate() {
    setActionError(null);
    setRemediating(true);
    try {
      const res = await runAutoRemediateAction();
      setRemediateResult(res);
      if (!res.ok) setActionError(res.detail);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setRemediating(false);
    }
  }

  // ──────────────────── render branches ────────────────────

  // "stopping" routes to whichever phase we WERE in: if we have a
  // scan summary, the stop arrived mid-remediation; otherwise it
  // arrived mid-scan. Either card shows a "stopping…" overlay.
  if (active?.status === "running") {
    return (
      <RunningCard
        kind={active.kind}
        startedAt={active.startedAt}
        startersDetail={startersDetail}
        events={active.events}
        stopping={false}
        onStop={stopCooking}
      />
    );
  }
  if (active?.status === "stopping" && !active.summary) {
    return (
      <RunningCard
        kind={active.kind}
        startedAt={active.startedAt}
        startersDetail={startersDetail}
        events={active.events}
        stopping
        onStop={stopCooking}
      />
    );
  }

  // YOLO/full-YOLO chain: scan finished, agent pool now opening PRs.
  // Show the scan summary inline so the user has context for what's
  // being remediated. "stopping" with a summary means the user
  // pressed stop during remediation — same UI, different flag.
  if (
    (active?.status === "remediating" ||
      (active?.status === "stopping" && active.summary)) &&
    active.summary
  ) {
    return (
      <RemediatingCard
        summary={active.summary}
        startedAt={active.startedAt}
        events={active.events}
        stopping={active.status === "stopping"}
        onStop={stopCooking}
      />
    );
  }

  if (active?.status === "failed") {
    return (
      <FailedCard
        kind={active.kind}
        message={active.error ?? "Unknown error"}
        onDismiss={dismiss}
        onRetryStarter={!starterComplete ? startStarter : undefined}
        onRetryFull={starterComplete ? startFull : undefined}
      />
    );
  }

  if (
    (active?.status === "completed" || active?.status === "cancelled") &&
    active.summary
  ) {
    return (
      <DoneCard
        summary={active.summary}
        wasFullScan={active.kind === "full"}
        autoRemediation={active.autoRemediation}
        events={active.events}
        wasCancelled={active.status === "cancelled"}
        onRunFullScan={startFull}
        onAutoRemediate={autoRemediate}
        onDismiss={dismiss}
        actionPending={actionPending}
        remediating={remediating}
        remediateResult={remediateResult}
        actionError={actionError}
      />
    );
  }
  // Cancelled WITHOUT a summary = user stopped before any scan
  // results existed (e.g. crash during file walk + immediate stop).
  // Render a tiny "stopped before any scan results" card with a
  // dismiss button.
  if (active?.status === "cancelled") {
    return <StoppedEarlyCard onDismiss={dismiss} />;
  }

  // ─── idle ───
  if (!starterComplete) {
    return (
      <IdleStarterCard
        startersDetail={startersDetail}
        onRun={startStarter}
        onBypass={bypass}
        disabled={actionPending}
        error={actionError}
      />
    );
  }
  return (
    <IdleFullCard
      onRun={startFull}
      disabled={actionPending}
      error={actionError}
    />
  );
}

// ───────── Idle (starter) ─────────

function IdleStarterCard({
  startersDetail,
  onRun,
  onBypass,
  disabled,
  error,
}: {
  startersDetail: Array<{ id: string; displayName: string; description: string }>;
  onRun: () => void;
  onBypass: () => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px solid var(--ink)",
        boxShadow: "6px 6px 0 var(--sauce)",
      }}
    >
      <div
        className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce)" }}
      >
        ▶ Your first scan
      </div>
      <h2
        className="font-black italic text-[28px] text-ink m-0 mb-3"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Start with a small, safe scan
      </h2>
      <p className="text-[14px] text-ink-soft m-0 mb-4 leading-relaxed">
        We&rsquo;ll run <strong>{startersDetail.length} static playbooks</strong>{" "}
        against your source files. No network calls, no test emails, no uploads
        — just grep-style pattern matching. It usually finishes in under a
        minute and costs zero AI tokens. Gives you a feel for what issues look
        like and how the board works before you turn on the full catalogue.
      </p>

      <div className="mb-4 grid gap-2">
        {startersDetail.map((p, i) => (
          <div
            key={p.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-md"
            style={{
              background: "var(--cream)",
              border: "1.5px solid var(--ink)",
            }}
          >
            <div
              className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold"
              style={{
                background: "var(--parmesan)",
                border: "1.5px solid var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {i + 1}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">
                {p.displayName}
              </div>
              <div className="text-[12px] text-ink-soft mt-0.5 leading-snug">
                {p.description}
              </div>
              <code
                className="text-[10px] text-ink-soft"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {p.id}
              </code>
            </div>
            <span
              className="text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-[2px] rounded shrink-0"
              style={{
                background: "#E4F0DF",
                color: "var(--basil-dark)",
                border: "1px solid var(--basil)",
                fontFamily: "var(--font-mono)",
              }}
            >
              safe
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Btn disabled={disabled} onClick={onRun} icon="🔎">
          Run starter scan
        </Btn>
        <Link
          href="/settings/tests"
          className="text-[13px] underline"
          style={{ color: "var(--ink-soft)" }}
        >
          Read about each test →
        </Link>
        <button
          type="button"
          onClick={onBypass}
          disabled={disabled}
          className="ml-auto text-[11px] underline disabled:opacity-50"
          style={{
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Skip — I know what I&rsquo;m doing
        </button>
      </div>

      {error && (
        <div
          className="mt-3 px-3 py-2 rounded text-[12px]"
          style={{
            background: "#FBE4E0",
            border: "1.5px solid var(--sauce)",
            color: "var(--sauce-dark)",
          }}
        >
          ✖ {error}
        </div>
      )}
    </div>
  );
}

// ───────── Idle (full scan, post-starter) ─────────

function IdleFullCard({
  onRun,
  disabled,
  error,
}: {
  onRun: () => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div
      className="rounded-xl p-5 mb-6 flex items-center gap-5 flex-wrap"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px solid var(--ink)",
        boxShadow: "4px 4px 0 var(--basil)",
      }}
    >
      <span className="text-[34px]" aria-hidden>
        🍝
      </span>
      <div className="flex-1 min-w-[200px]">
        <div
          className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1"
          style={{ fontFamily: "var(--font-mono)", color: "var(--basil-dark)" }}
        >
          ▶ Run a scan
        </div>
        <h3
          className="font-black italic text-[20px] text-ink m-0 leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Ready to cook the full pot?
        </h3>
        <p className="text-[12.5px] text-ink-soft mt-1 m-0 leading-snug">
          Runs every playbook relevant to your stack with AI confirm on. A few
          minutes for a small project; you can navigate away while it runs.
        </p>
      </div>
      <Btn disabled={disabled} onClick={onRun} icon="🔍">
        Run full scan
      </Btn>
      {error && (
        <div
          className="basis-full px-3 py-2 rounded text-[12px]"
          style={{
            background: "#FBE4E0",
            border: "1.5px solid var(--sauce)",
            color: "var(--sauce-dark)",
          }}
        >
          ✖ {error}
        </div>
      )}
    </div>
  );
}

// ───────── Running ─────────

function RunningCard({
  kind,
  startedAt,
  startersDetail,
  events,
  stopping,
  onStop,
}: {
  kind: "starter" | "full";
  startedAt: number;
  startersDetail: Array<{ id: string; displayName: string; description: string }>;
  events: ActiveScanState["events"];
  /** True after the user clicked stop — runners draining at next checkpoint. */
  stopping: boolean;
  onStop: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(Date.now() - startedAt);
  const startedAtRef = useRef(startedAt);
  startedAtRef.current = startedAt;

  // Phase walker — for starter, walk through each playbook. For full
  // scans we don't have a fixed list to walk, just show "scanning".
  const phases =
    kind === "starter"
      ? [
          ...startersDetail.map((p) => ({
            id: p.id,
            label: `Checking ${p.displayName.toLowerCase()}…`,
          })),
          { id: "__wrapup__", label: "Wrapping up…" },
        ]
      : [];
  const [phaseIdx, setPhaseIdx] = useState(0);
  useEffect(() => {
    if (phases.length === 0) return;
    const interval = window.setInterval(() => {
      setPhaseIdx((i) => (i < phases.length - 1 ? i + 1 : i));
    }, 900);
    return () => window.clearInterval(interval);
  }, [phases.length]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);
    return () => window.clearInterval(tick);
  }, []);

  const seconds = (elapsedMs / 1000).toFixed(1);
  const slow = elapsedMs > (kind === "full" ? 180_000 : 30_000);

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px solid var(--ink)",
        boxShadow: "6px 6px 0 var(--sauce-dark)",
      }}
    >
      <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
        <div className="shrink-0 mx-auto">
          <CookingMarinara size={180} />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--sauce-soft)",
            }}
          >
            ● {kind === "full" ? "Full scan" : "Scanning"} · {seconds}s
          </div>
          <h2
            className="font-black italic text-[26px] text-ink m-0 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {kind === "full"
              ? "The whole kitchen's cooking."
              : "Marinara's in the kitchen."}
          </h2>
          <p className="text-[13.5px] text-ink-soft m-0 mb-4 leading-snug">
            {kind === "full"
              ? "Every playbook relevant to your stack, with AI confirm on. Feel free to wander — board, settings, agents — this card will be waiting when the scan finishes."
              : `Walking your source tree and checking the ${phases.length - 1} starter playbooks. Runs entirely on your machine — no AI calls, no network.`}
          </p>

          {phases.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {phases.map((p, i) => {
                const done = i < phaseIdx;
                const current = i === phaseIdx;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5 text-[13px]"
                    style={{
                      color: done
                        ? "var(--ink-soft)"
                        : current
                          ? "var(--ink)"
                          : "rgba(34,26,20,0.35)",
                    }}
                  >
                    <span
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: done
                          ? "var(--basil)"
                          : current
                            ? "var(--sauce)"
                            : "var(--cream)",
                        color:
                          done || current
                            ? "var(--cream)"
                            : "var(--ink-soft)",
                        border: "1.5px solid var(--ink)",
                        fontFamily: "var(--font-mono)",
                      }}
                      aria-hidden
                    >
                      {done ? "✓" : current ? "•" : i + 1}
                    </span>
                    <span
                      style={{
                        fontWeight: current ? 600 : 400,
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {p.label}
                    </span>
                    {current && (
                      <span
                        className="text-[10px] ml-auto"
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--sauce)",
                        }}
                      >
                        running…
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {slow && (
            <div
              className="mt-3 text-[11px] px-2.5 py-1.5 rounded inline-block"
              style={{
                background: "var(--parmesan)",
                border: "1px solid var(--ink)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            >
              ⏳ Taking longer than usual — large repos can. Hang tight.
            </div>
          )}
        </div>
      </div>
      {/* Live event log — expand to see playbooks running, candidates
          spotted, AI calls. Default open during a run so the user
          has something to watch instead of a static spinner. */}
      <div className="mt-4">
        <ProgressLog events={events} live defaultOpen />
      </div>
      {/* Stop cooking — visible bottom-right of the running card. */}
      <div className="mt-4 flex justify-end">
        <StopCookingButton
          stopping={stopping}
          onStop={onStop}
          phaseLabel="scan"
        />
      </div>
    </div>
  );
}

// ───────── Remediating (YOLO post-scan) ─────────

/**
 * Phase 2 of the YOLO chain: scan finished, agent pool is now
 * walking every backlog/ready issue and opening PRs. This is its own
 * card so the user sees a clear visual handoff from "scanning" to
 * "remediating" — and so the elapsed timer resets to feel like real
 * progress on the new phase.
 *
 * Server-side, this lives in the same active-scan promise as the
 * scan that triggered it. The user can navigate away and come back
 * — the polling re-syncs whatever state the singleton is in.
 */
function RemediatingCard({
  summary,
  startedAt,
  events,
  stopping,
  onStop,
}: {
  summary: NonNullable<ActiveScanState["summary"]>;
  /** When the scan started — used to show a fused elapsed timer. */
  startedAt: number;
  events: ActiveScanState["events"];
  stopping: boolean;
  onStop: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(Date.now() - startedAt);
  const startedAtRef = useRef(startedAt);
  startedAtRef.current = startedAt;
  useEffect(() => {
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    return () => window.clearInterval(tick);
  }, []);
  const seconds = Math.floor(elapsedMs / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const elapsed = m > 0 ? `${m}m ${s}s` : `${s}s`;

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px solid var(--ink)",
        boxShadow: "6px 6px 0 var(--sauce)",
      }}
    >
      <div className="flex items-start gap-6 flex-wrap md:flex-nowrap">
        <div className="shrink-0 mx-auto">
          <CookingMarinara size={180} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--sauce-soft)",
            }}
          >
            ● Auto-remediating · {elapsed} elapsed
          </div>
          <h2
            className="font-black italic text-[26px] text-ink m-0 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Agents are opening PRs.
          </h2>
          <p className="text-[13.5px] text-ink-soft m-0 mb-3 leading-snug">
            You&rsquo;re in <strong>{summary.autonomy}</strong> mode, so the
            scan flowed straight into auto-remediation — agents are working
            through every backlog/ready issue and opening a PR for each
            fix.
          </p>
          <p className="text-[12.5px] text-ink-soft m-0 leading-snug">
            A minute per issue is normal. Feel free to wander —{" "}
            <Link
              href="/board"
              className="underline"
              style={{ color: "var(--sauce)" }}
            >
              the board
            </Link>{" "}
            updates live, and this card waits for you when you come back.
          </p>
        </div>
      </div>

      {/* Scan-summary strip so the user remembers what spawned this. */}
      <div
        className="rounded-[10px] px-4 py-2 mt-4 text-[11.5px] flex flex-wrap gap-x-4 gap-y-1"
        style={{
          background: "var(--cream)",
          border: "1.5px solid var(--ink)",
          fontFamily: "var(--font-mono)",
          color: "var(--ink-soft)",
        }}
      >
        <span>scan: {summary.scanId}</span>
        <span>found: {summary.issuesFound} new</span>
        <span>
          provider: {summary.scannedPath.split("/").slice(-1)[0]}
        </span>
      </div>

      {/* Live event log — agents picking up issues, AI calls coming
          back, Nonna's verdicts, PRs landing. Open by default
          during remediation since it's the only signal of progress
          while individual issues are being patched. */}
      <div className="mt-4">
        <ProgressLog events={events} live defaultOpen />
      </div>
      {/* Stop cooking — visible bottom-right of the remediation card. */}
      <div className="mt-4 flex justify-end">
        <StopCookingButton
          stopping={stopping}
          onStop={onStop}
          phaseLabel="remediation"
        />
      </div>
    </div>
  );
}

// ───────── Done ─────────

function DoneCard({
  summary,
  wasFullScan,
  autoRemediation,
  events,
  wasCancelled,
  onRunFullScan,
  onAutoRemediate,
  onDismiss,
  actionPending,
  remediating,
  remediateResult,
  actionError,
}: {
  summary: NonNullable<ActiveScanState["summary"]>;
  wasFullScan: boolean;
  /** YOLO auto-remediation that fired automatically after the scan. */
  autoRemediation?: AutoRemediationResult;
  /**
   * True when the run finished because the user clicked stop, not
   * because it ran to completion. The summary still reflects what
   * was done before the stop — same fields, partial values.
   */
  wasCancelled?: boolean;
  events: ActiveScanState["events"];
  onRunFullScan: () => void;
  onAutoRemediate: () => void;
  onDismiss: () => void;
  actionPending: boolean;
  remediating: boolean;
  remediateResult: AutoRemediateResult | null;
  actionError: string | null;
}) {
  const s = summary;
  // Either remediation has happened (auto or manual), OR it hasn't.
  // Coalesce so the rendering treats both flavours identically.
  const renderedRemediation: {
    ok: boolean;
    detail: string;
    prUrls: string[];
    /** Issues that needed approval (won't be PR'd until human says go). */
    gatedCount: number;
    /** Issues that errored out — bad token, bad model output, etc. */
    failedCount: number;
    /** Per-issue failure detail so the user can see WHY it failed. */
    failures: Array<{ issueId: string; error: string }>;
    /** "auto" → ran automatically; "manual" → user clicked button. */
    source: "auto" | "manual";
  } | null = autoRemediation
    ? {
        ok: autoRemediation.ok,
        detail: autoRemediation.detail,
        prUrls: autoRemediation.prUrls,
        gatedCount: autoRemediation.gated.length,
        failedCount: autoRemediation.failed.length,
        failures: autoRemediation.failed,
        source: "auto",
      }
    : remediateResult
      ? {
          ok: remediateResult.ok,
          detail: remediateResult.detail,
          prUrls: remediateResult.prUrls,
          gatedCount: remediateResult.gated.length,
          failedCount: remediateResult.failed.length,
          failures: remediateResult.failed,
          source: "manual",
        }
      : null;
  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px solid var(--ink)",
        boxShadow: "6px 6px 0 var(--basil)",
      }}
    >
      <div
        className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
        style={{
          fontFamily: "var(--font-mono)",
          color: wasCancelled ? "var(--sauce-dark)" : "var(--basil-dark)",
        }}
      >
        {wasCancelled
          ? `🛑 ${wasFullScan ? "Full scan" : "Starter scan"} stopped`
          : `✓ ${wasFullScan ? "Full scan complete" : "Starter scan complete"}`}
      </div>
      {wasCancelled && (
        <div
          className="rounded-lg p-3 mb-3 text-[12.5px] leading-snug"
          style={{
            background: "var(--parmesan)",
            border: "1.5px solid var(--ink)",
          }}
        >
          You stopped the run before it finished. Anything below
          reflects what was already done — issues found are on the
          board, PRs already opened are on GitHub, and any unattempted
          work is left at backlog/ready for a future run.
        </div>
      )}
      <h2
        className="font-black italic text-[28px] text-ink m-0 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {s.issuesFound === 0
          ? "Spotless."
          : `Found ${s.issuesFound} issue${s.issuesFound === 1 ? "" : "s"}.`}
      </h2>

      <div
        className="rounded-[10px] px-4 py-3 mb-4 text-[12.5px] leading-relaxed"
        style={{
          background: "var(--cream)",
          border: "1.5px solid var(--ink)",
        }}
      >
        <div className="flex gap-3 flex-wrap">
          <div>
            <span
              className="text-[10px] font-bold tracking-[0.1em] uppercase block mb-0.5"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--ink-soft)",
              }}
            >
              target
            </span>
            <code style={{ fontFamily: "var(--font-mono)" }}>
              {s.scannedPath}
            </code>
          </div>
          <div>
            <span
              className="text-[10px] font-bold tracking-[0.1em] uppercase block mb-0.5"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--ink-soft)",
              }}
            >
              scanned
            </span>
            <span>
              {s.filesScanned} files · {s.playbooksRun} playbooks
            </span>
          </div>
          <div>
            <span
              className="text-[10px] font-bold tracking-[0.1em] uppercase block mb-0.5"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--ink-soft)",
              }}
            >
              scan id
            </span>
            <code style={{ fontFamily: "var(--font-mono)" }}>{s.scanId}</code>
          </div>
        </div>
        {s.topFiles.length > 0 && (
          <div
            className="mt-2 pt-2 text-[12px] text-ink-soft"
            style={{ borderTop: "1px dashed rgba(34,26,20,0.18)" }}
          >
            <strong className="font-semibold">Top files:</strong>{" "}
            {s.topFiles.map((f, i) => (
              <code
                key={f}
                className="inline-block"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {f}
                {i < s.topFiles.length - 1 ? ", " : ""}
              </code>
            ))}
          </div>
        )}
      </div>

      {/* "Why are agents waiting?" banner — only shown for YOLO users
          when remediation hasn't happened (which would be very unusual
          since YOLO auto-fires post-scan, but covers the edge case
          where auto-fire was skipped). */}
      {s.issuesFound > 0 &&
        s.yoloMode &&
        !renderedRemediation &&
        !remediating && (
          <div
            className="rounded-[10px] px-4 py-3 mb-4"
            style={{
              background: "var(--parmesan)",
              border: "2px solid var(--ink)",
            }}
          >
            <div
              className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--sauce-dark)",
              }}
            >
              🚀 You&rsquo;re in {s.autonomy} mode
            </div>
            <div className="text-[13px] text-ink">
              Auto-remediation should have fired automatically — if it
              didn&rsquo;t, hit the button below to retry, or check the
              board for individual triage.
            </div>
          </div>
        )}

      {remediating && (
        <div
          className="rounded-[10px] px-4 py-3 mb-4 flex items-center gap-3"
          style={{
            background: "var(--parmesan)",
            border: "2px solid var(--ink)",
          }}
        >
          <CookingMarinara size={44} />
          <div className="text-[13px] text-ink">
            Agents are opening PRs — a minute per issue is normal. Keep this
            tab open.
          </div>
        </div>
      )}

      {renderedRemediation && (
        <div
          className="rounded-[10px] px-4 py-3 mb-4 text-[13px]"
          style={{
            background: renderedRemediation.ok ? "#E4F0DF" : "#FBE4E0",
            border: `2px solid ${renderedRemediation.ok ? "var(--basil)" : "var(--sauce)"}`,
          }}
        >
          <div
            className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1"
            style={{
              fontFamily: "var(--font-mono)",
              color: renderedRemediation.ok
                ? "var(--basil-dark)"
                : "var(--sauce-dark)",
            }}
          >
            {renderedRemediation.ok ? "✓ " : "✖ "}
            {renderedRemediation.source === "auto"
              ? "Auto-remediation (YOLO)"
              : "Remediation"}{" "}
            {renderedRemediation.ok ? "complete" : "failed"}
          </div>
          <div className="text-ink mb-2">{renderedRemediation.detail}</div>
          {renderedRemediation.prUrls.length > 0 && (
            <>
              <div
                className="text-[10px] font-bold tracking-[0.1em] uppercase mt-2 mb-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                Pull requests opened
              </div>
              <ul className="list-none p-0 m-0 flex flex-col gap-1">
                {renderedRemediation.prUrls.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[12.5px]"
                      style={{
                        color: "var(--sauce)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Gated CTA — auto-remediation never opens PRs for issues
              that match approval triggers (auth changes, secrets,
              schema migrations, critical severity in recommended).
              Direct the user to the board where they can click
              "Approve & open PR" on each one. Without this CTA the
              user is left with "4 gated for approval" and no idea
              where to go next. */}
          {renderedRemediation.gatedCount > 0 && (
            <div
              className="mt-3 pt-2 flex items-center justify-between gap-2 flex-wrap"
              style={{ borderTop: "1px dashed rgba(34,26,20,0.18)" }}
            >
              <div
                className="text-[12px] text-ink"
                style={{ lineHeight: 1.4 }}
              >
                <strong>
                  {renderedRemediation.gatedCount} gated for approval
                </strong>{" "}
                — these matched an approval trigger (auth / secrets /
                schema / critical) and need your sign-off.
              </div>
              <Link
                href="/board?filter=pending_approval"
                className="text-[12px] font-bold underline whitespace-nowrap"
                style={{
                  color: "var(--sauce)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Review & approve →
              </Link>
            </div>
          )}
          {renderedRemediation.failedCount > 0 && (
            <FailureBreakdown
              failures={renderedRemediation.failures}
              scanId={s.scanId}
            />
          )}
        </div>
      )}

      {actionError && (
        <div
          className="mb-4 px-3 py-2 rounded text-[12px]"
          style={{
            background: "#FBE4E0",
            border: "1.5px solid var(--sauce)",
            color: "var(--sauce-dark)",
          }}
        >
          ✖ {actionError}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {/* Auto-remediate manual trigger — visible when:
            - User has issues, AND
            - YOLO didn't auto-fire (autoRemediation absent), AND
            - User hasn't already clicked it (renderedRemediation absent)
            In recommended/careful modes this is the only path; in YOLO
            it's a backup if auto-fire was skipped (e.g. token missing). */}
        {s.issuesFound > 0 && !renderedRemediation && (
          <Btn
            icon="🚀"
            onClick={onAutoRemediate}
            disabled={remediating || actionPending}
          >
            {remediating
              ? "Auto-remediating…"
              : `Auto-remediate all ${s.issuesFound} issue${s.issuesFound === 1 ? "" : "s"}`}
          </Btn>
        )}

        {/* Run full scan — only after a starter. */}
        {!wasFullScan && (
          <Btn
            icon="🔍"
            onClick={onRunFullScan}
            disabled={actionPending || remediating}
          >
            Run full scan
          </Btn>
        )}

        {s.issuesFound > 0 && (
          <Link
            href="/board"
            className="text-[13px] underline"
            style={{ color: "var(--ink-soft)" }}
          >
            Open the board →
          </Link>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-[11px] underline"
          style={{
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          ✕ Dismiss
        </button>
      </div>

      {/* Progress log — closed by default on the done card since
          the user mostly wants the summary, but available for
          post-mortem ("which playbook found ISSUE-061?", "did
          Nonna review this?"). */}
      <div className="mt-4">
        <ProgressLog events={events} live={false} />
      </div>
    </div>
  );
}

// ───────── Failure breakdown ─────────

/**
 * Renders the verbatim per-issue error messages from a remediation
 * pool run. The error data is captured server-side in
 * `result.failed[].error`, but until now we only showed the count
 * ("21 failed") which gave the user nothing to act on.
 *
 * Identical error messages are grouped (e.g. 21× "git push failed:
 * 403 Forbidden") so a systemic failure shows once with a count
 * rather than 21 near-identical lines. We also tag the most likely
 * cause so the user knows where to look.
 */
function FailureBreakdown({
  failures,
  scanId,
}: {
  failures: Array<{ issueId: string; error: string }>;
  /** Scan id used to point at the JSONL log file written during the run. */
  scanId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Group identical messages.
  const groups = new Map<string, string[]>();
  for (const f of failures) {
    const list = groups.get(f.error) ?? [];
    list.push(f.issueId);
    groups.set(f.error, list);
  }
  const sorted = Array.from(groups.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  // 100% identical = systemic. Tag it.
  const allSame = sorted.length === 1 && failures.length > 1;
  const hint = allSame ? guessSystemicCause(sorted[0]![0]) : null;

  return (
    <div
      className="mt-3 pt-2"
      style={{ borderTop: "1px dashed rgba(34,26,20,0.18)" }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div
          className="text-[12px] text-ink"
          style={{ lineHeight: 1.4 }}
        >
          <strong>{failures.length} failed</strong>
          {allSame && (
            <>
              {" "}
              — all with the <em>same</em> error, which usually means a
              systemic problem rather than per-issue bugs.
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] underline whitespace-nowrap"
          style={{
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {expanded ? "▾ hide errors" : "▸ show errors"}
        </button>
      </div>

      {hint && (
        <div
          className="mb-2 text-[12px] px-2.5 py-1.5 rounded leading-snug"
          style={{
            background: "var(--parmesan)",
            border: "1.5px solid var(--ink)",
            color: "var(--ink)",
          }}
        >
          <strong>💡 Likely cause:</strong> {hint}
        </div>
      )}

      {expanded && (
        <div className="flex flex-col gap-2 mt-2">
          {sorted.map(([msg, ids], i) => (
            <details
              key={i}
              open={i === 0}
              className="rounded text-[11.5px]"
              style={{
                background: "var(--cream)",
                border: "1px solid var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <summary
                className="cursor-pointer px-2.5 py-1.5"
                style={{ fontWeight: 600 }}
              >
                {ids.length}× — affects {ids.slice(0, 3).join(", ")}
                {ids.length > 3 && ` +${ids.length - 3} more`}
              </summary>
              <pre
                className="px-2.5 py-2 m-0 whitespace-pre-wrap break-all"
                style={{
                  background: "var(--ink)",
                  color: "var(--cream)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  borderTop: "1px solid var(--ink)",
                  lineHeight: 1.45,
                }}
              >
                {msg}
              </pre>
            </details>
          ))}
          <div
            className="mt-1 text-[11px]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--ink-soft)",
              lineHeight: 1.45,
            }}
          >
            Full structured log:{" "}
            <code
              className="px-1.5 py-[1px] rounded"
              style={{
                background: "var(--cream)",
                border: "1px solid rgba(34,26,20,0.3)",
              }}
            >
              .ohpentesting/logs/{scanId}.jsonl
            </code>{" "}
            — every agent action, AI call, and git step is recorded
            there. <code>cat</code> or <code>jq</code> it from a
            terminal to see the full trace.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pattern-match common error strings against likely root causes so
 * the user gets a starting point. False negatives are fine — we
 * just don't show the hint, never something misleading.
 */
function guessSystemicCause(err: string): string | null {
  const lower = err.toLowerCase();
  if (
    lower.includes("403") ||
    lower.includes("permission") ||
    lower.includes("authentication failed")
  ) {
    return "Your GitHub token can't push to this repo. Most common causes: (a) the token is fine-grained and missing 'Contents: write', (b) the local clone is using HTTPS without auth — try regenerating the token with full 'repo' scope, or set up SSH for the clone.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("429")
  ) {
    return "Provider rate limit hit. Wait a few minutes or switch provider in /settings.";
  }
  if (
    lower.includes("not a git repo") ||
    lower.includes("not a git repository")
  ) {
    return "The scan target directory isn't a git repo, so the agent can't create a branch or commit. Check the scan-target path in the banner — if it's pointing at the wrong folder, relaunch from inside the project clone.";
  }
  if (lower.includes("nothing to commit") || lower.includes("clean working")) {
    return "The agent's patch was identical to the existing file — likely the LLM returned the file unchanged. This sometimes happens with very small or already-correct snippets. Try Recommended autonomy mode for individual review, or check the playbook prompt.";
  }
  if (
    lower.includes("branch already exists") ||
    lower.includes("already exists")
  ) {
    return "A branch from a prior failed run is in the way. Delete branches starting with 'ohpen/issue-' (locally and on the remote), then retry.";
  }
  if (
    lower.includes("could not parse") ||
    lower.includes("json") ||
    lower.includes("zod") ||
    lower.includes("schema")
  ) {
    return "The AI provider returned a response the agent couldn't parse as JSON. Often a model misconfiguration — check that the provider supports structured JSON output, or switch to a stronger model.";
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("network")
  ) {
    return "Network error reaching the provider or GitHub. Check connectivity, then retry.";
  }
  if (lower.includes("enoent")) {
    return "A file the agent expected to exist isn't there. Often the scan was run against a different cwd than where remediation is happening. Check the scan-target banner.";
  }
  return null;
}

// ───────── Failed ─────────

function FailedCard({
  kind,
  message,
  onDismiss,
  onRetryStarter,
  onRetryFull,
}: {
  kind: "starter" | "full";
  message: string;
  onDismiss: () => void;
  onRetryStarter?: () => void;
  onRetryFull?: () => void;
}) {
  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px solid var(--sauce)",
        boxShadow: "6px 6px 0 var(--sauce-dark)",
      }}
    >
      <div
        className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--sauce-dark)",
        }}
      >
        ✖ {kind === "full" ? "Full scan" : "Starter scan"} failed
      </div>
      <h2
        className="font-black italic text-[22px] text-ink m-0 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Something went wrong mid-scan.
      </h2>
      <pre
        className="mt-2 mb-3 px-3 py-2 rounded text-[11px] whitespace-pre-wrap break-words"
        style={{
          background: "#FBE4E0",
          border: "1.5px solid var(--sauce)",
          color: "var(--sauce-dark)",
          fontFamily: "var(--font-mono)",
          margin: 0,
        }}
      >
        {message}
      </pre>
      <p className="text-[12px] text-ink-soft mb-3 leading-snug">
        Common causes: provider rate-limit, network blip, or files the scanner
        can&rsquo;t read. Try again, or run{" "}
        <code
          className="px-1 rounded"
          style={{ background: "var(--parmesan)" }}
        >
          opt scan
        </code>{" "}
        in your terminal for the full stack trace.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        {onRetryStarter && (
          <Btn icon="↻" onClick={onRetryStarter}>
            Try starter again
          </Btn>
        )}
        {onRetryFull && (
          <Btn icon="↻" onClick={onRetryFull}>
            Try full scan again
          </Btn>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-[11px] underline"
          style={{
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          ✕ Dismiss
        </button>
      </div>
    </div>
  );
}

// ───────── Stop cooking button + early-stop fallback ─────────

/**
 * "🛑 Stop cooking" button shown on RunningCard and RemediatingCard.
 *
 * Two states:
 *   - idle: red button, click opens a confirm and fires the abort.
 *   - stopping: disabled, shows a tiny spinner + "Stopping…" so
 *     the user knows their click registered while the runners
 *     drain at the next checkpoint (an in-flight AI call has to
 *     finish, which can take 5-30s).
 *
 * The button visually echoes the kitchen metaphor — "stop cooking"
 * vs "still cooking" — so the action feels native to Marinara's
 * voice rather than a generic Cancel.
 */
function StopCookingButton({
  stopping,
  onStop,
  phaseLabel,
}: {
  stopping: boolean;
  onStop: () => void;
  /** "scan" or "remediation" — surfaces in the button title-tip. */
  phaseLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onStop}
      disabled={stopping}
      title={
        stopping
          ? `Stopping ${phaseLabel}… runners halt at the next safe checkpoint`
          : `Stop the ${phaseLabel}. Anything already done is kept.`
      }
      className="text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-70"
      style={{
        background: stopping ? "var(--ink-soft)" : "var(--sauce-dark)",
        color: "var(--cream)",
        border: "2px solid var(--ink)",
        boxShadow: stopping ? undefined : "2px 2px 0 var(--ink)",
        cursor: stopping ? "wait" : "pointer",
        fontFamily: "var(--font-mono)",
      }}
    >
      {stopping ? (
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-[8px] h-[8px] rounded-full animate-pulse"
            style={{ background: "var(--cream)" }}
            aria-hidden
          />
          Stopping…
        </span>
      ) : (
        "🛑 Stop cooking"
      )}
    </button>
  );
}

/**
 * Tiny "stopped before any results" card. Appears when the user
 * cancels a scan so quickly that no scan summary was produced
 * (e.g. mid-file-walk). Just acknowledges the stop and offers a
 * dismiss — there's nothing to summarise.
 */
function StoppedEarlyCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="rounded-xl p-5 mb-6 flex items-center gap-4 flex-wrap"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px solid var(--ink)",
        boxShadow: "4px 4px 0 var(--sauce-dark)",
      }}
    >
      <span className="text-[28px]" aria-hidden>
        🛑
      </span>
      <div className="flex-1 min-w-[200px]">
        <h3
          className="font-black italic text-[18px] text-ink m-0 leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Stopped before any results.
        </h3>
        <p className="text-[12.5px] text-ink-soft mt-1 m-0 leading-snug">
          You hit stop very early — nothing was scanned long enough to
          report. No issues created, no PRs opened. Run another scan
          when you&rsquo;re ready.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[12px] underline"
        style={{
          color: "var(--ink-soft)",
          fontFamily: "var(--font-mono)",
        }}
      >
        ✕ Dismiss
      </button>
    </div>
  );
}
