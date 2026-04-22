"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Btn } from "../../components/trattoria/button";
import { runStarterScanAction, bypassStarterAction } from "./actions";

/**
 * First-scan gate.
 *
 * Shown on the /scans page when `config.scans.starter_complete` is
 * false. Explains what the starter scan does, what it *doesn't* do,
 * and offers three affordances:
 *   1. Primary — Run starter scan (kicks the server action)
 *   2. Secondary — Learn more about each test (link to Settings → Tests)
 *   3. Tiny — Skip, I know what I'm doing (bypass action)
 *
 * The copy is deliberately reassuring: most first-time users who've
 * never used a pen-test tool are worried about breaking their app.
 * We're explicit that this run is purely static.
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
    return (
      <div
        className="rounded-xl p-6"
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
          {result.issuesFound === 0
            ? "Spotless."
            : `Found ${result.issuesFound} issue${result.issuesFound === 1 ? "" : "s"}.`}
        </h2>
        <p className="text-[14px] text-ink-soft m-0 mb-4">
          Scan <code style={{ fontFamily: "var(--font-mono)" }}>{result.scanId}</code>{" "}
          is saved. Head to the{" "}
          <Link href="/board" className="underline" style={{ color: "var(--sauce)" }}>
            board
          </Link>{" "}
          to triage, or scroll down for the full catalog — now unlocked.
        </p>
        <Btn icon="↻" onClick={() => window.location.reload()}>
          See my scans
        </Btn>
      </div>
    );
  }

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
        <Btn disabled={pending} onClick={runStarter} icon="🔎">
          {pending ? "Running starter scan…" : "Run starter scan"}
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
          onClick={bypass}
          disabled={pending}
          className="ml-auto text-[11px] underline disabled:opacity-50"
          style={{
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Skip — I know what I&rsquo;m doing
        </button>
      </div>

      {result && !result.ok && (
        <div
          className="mt-3 px-3 py-2 rounded text-[12px]"
          style={{
            background: "#FBE4E0",
            border: "1.5px solid var(--sauce)",
            color: "var(--sauce-dark)",
          }}
        >
          ✖ {result.error}
        </div>
      )}
    </div>
  );
}
