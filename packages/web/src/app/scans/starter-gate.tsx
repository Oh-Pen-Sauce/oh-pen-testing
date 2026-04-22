"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Btn } from "../../components/trattoria/button";
import { runStarterScanAction, bypassStarterAction } from "./actions";
import { CookingMarinara } from "./cooking-marinara";

/**
 * First-scan gate.
 *
 * Three visual states:
 *   - idle     → explainer card + Run button
 *   - running  → CookingMarinara animation + phase walker + elapsed timer
 *   - done     → success card with found-issue count
 *
 * Since runStarterScanAction is a single blocking server action that
 * returns when the scan is complete, we don't have real progress
 * events. A phase walker simulates forward motion by advancing through
 * the list of starter playbooks on a timer. If the real scan finishes
 * first (typical — starter runs in seconds) we jump straight to done.
 * If it's still going when we reach the last phase, we hold on
 * "Wrapping up…" until the action resolves. This stops the UI feeling
 * frozen without lying about real progress.
 */
export function StarterGate({
  startersDetail,
}: {
  startersDetail: Array<{ id: string; displayName: string; description: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | null
    | { ok: true; scanId: string; issuesFound: number }
    | { ok: false; error: string }
  >(null);

  function runStarter() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await runStarterScanAction();
        setResult(res);
      } catch (err) {
        setResult({ ok: false, error: (err as Error).message });
      }
    });
  }

  function bypass() {
    if (
      !confirm(
        "Skip the starter scan? You'll go straight to the full catalog. You can always come back.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      await bypassStarterAction();
      window.location.reload();
    });
  }

  if (result?.ok) {
    return <DoneCard scanId={result.scanId} issuesFound={result.issuesFound} />;
  }

  if (pending) {
    return (
      <RunningCard
        phases={[
          ...startersDetail.map((p) => ({
            id: p.id,
            label: `Checking ${p.displayName.toLowerCase()}…`,
          })),
          { id: "__wrapup__", label: "Wrapping up…" },
        ]}
      />
    );
  }

  return (
    <IdleCard
      startersDetail={startersDetail}
      onRun={runStarter}
      onBypass={bypass}
      disabled={false}
      error={result && !result.ok ? result.error : null}
    />
  );
}

// ───────── Idle ─────────

function IdleCard({
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

// ───────── Running ─────────

function RunningCard({
  phases,
}: {
  phases: Array<{ id: string; label: string }>;
}) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  // Phase walker — advance every ~900ms, hold on the last (wrapup) phase.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhaseIdx((i) => (i < phases.length - 1 ? i + 1 : i));
    }, 900);
    return () => window.clearInterval(interval);
  }, [phases.length]);

  // Elapsed-time ticker — 100ms granularity, rendered as 1-decimal seconds.
  useEffect(() => {
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);
    return () => window.clearInterval(tick);
  }, []);

  const seconds = (elapsedMs / 1000).toFixed(1);

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
            ● Scanning · {seconds}s
          </div>
          <h2
            className="font-black italic text-[26px] text-ink m-0 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Marinara&rsquo;s in the kitchen.
          </h2>
          <p className="text-[13.5px] text-ink-soft m-0 mb-4 leading-snug">
            Walking your source tree and checking the{" "}
            {phases.length - 1} starter playbooks. This runs entirely on
            your machine — no AI calls, no network.
          </p>

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
        </div>
      </div>
    </div>
  );
}

// ───────── Done ─────────

function DoneCard({
  scanId,
  issuesFound,
}: {
  scanId: string;
  issuesFound: number;
}) {
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
        ✓ Starter scan complete
      </div>
      <h2
        className="font-black italic text-[28px] text-ink m-0 mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {issuesFound === 0
          ? "Spotless."
          : `Found ${issuesFound} issue${issuesFound === 1 ? "" : "s"}.`}
      </h2>
      <p className="text-[14px] text-ink-soft m-0 mb-4">
        Scan{" "}
        <code style={{ fontFamily: "var(--font-mono)" }}>{scanId}</code> is
        saved. Head to the{" "}
        <Link
          href="/board"
          className="underline"
          style={{ color: "var(--sauce)" }}
        >
          board
        </Link>{" "}
        to triage, or reload for the full catalog — now unlocked.
      </p>
      <Btn icon="↻" onClick={() => window.location.reload()}>
        See my scans
      </Btn>
    </div>
  );
}
