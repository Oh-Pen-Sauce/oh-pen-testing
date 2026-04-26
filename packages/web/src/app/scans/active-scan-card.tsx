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
  // remediating so the phase-flip from scan→remediate→done feels snappy.
  useEffect(() => {
    const isLive =
      active?.status === "running" || active?.status === "remediating";
    const intervalMs = isLive ? 1500 : 4000;
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

  if (active?.status === "running") {
    return (
      <RunningCard
        kind={active.kind}
        startedAt={active.startedAt}
        startersDetail={startersDetail}
      />
    );
  }

  // YOLO/full-YOLO chain: scan finished, agent pool now opening PRs.
  // Show the scan summary inline so the user has context for what's
  // being remediated.
  if (active?.status === "remediating" && active.summary) {
    return (
      <RemediatingCard
        summary={active.summary}
        startedAt={active.startedAt}
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

  if (active?.status === "completed" && active.summary) {
    return (
      <DoneCard
        summary={active.summary}
        wasFullScan={active.kind === "full"}
        autoRemediation={active.autoRemediation}
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
}: {
  kind: "starter" | "full";
  startedAt: number;
  startersDetail: Array<{ id: string; displayName: string; description: string }>;
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
}: {
  summary: NonNullable<ActiveScanState["summary"]>;
  /** When the scan started — used to show a fused elapsed timer. */
  startedAt: number;
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
    </div>
  );
}

// ───────── Done ─────────

function DoneCard({
  summary,
  wasFullScan,
  autoRemediation,
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
    /** "auto" → ran automatically; "manual" → user clicked button. */
    source: "auto" | "manual";
  } | null = autoRemediation
    ? {
        ok: autoRemediation.ok,
        detail: autoRemediation.detail,
        prUrls: autoRemediation.prUrls,
        source: "auto",
      }
    : remediateResult
      ? {
          ok: remediateResult.ok,
          detail: remediateResult.detail,
          prUrls: remediateResult.prUrls,
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
          color: "var(--basil-dark)",
        }}
      >
        ✓ {wasFullScan ? "Full scan complete" : "Starter scan complete"}
      </div>
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
    </div>
  );
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
