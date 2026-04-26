"use client";

import { useState } from "react";
import { pingGitHubAction } from "./actions";
import type { PreflightResult } from "@oh-pen-testing/git-github";

/**
 * "Taste test" — a one-click pre-flight that runs the full GitHub
 * remediation pipeline (token check, repo access, push dry-run)
 * WITHOUT actually committing or opening a PR. Lets users catch
 * misconfiguration before they kick off a scan and watch 21
 * remediations fail.
 *
 * Each step renders as a green tick (✓) or red cross (✖) with the
 * actual error text underneath when something fails. Click "Run
 * taste test" again after fixing — same flow, no extra setup.
 */
export function TasteTest() {
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await pingGitHubAction();
      setResult(res);
    } catch (err) {
      setResult({
        ok: false,
        authenticatedAs: null,
        steps: [
          {
            name: "Pre-flight",
            status: "fail",
            detail: (err as Error).message,
          },
        ],
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="rounded-xl p-5 mt-5"
      style={{
        background: "var(--cream-soft)",
        border: "2px solid var(--ink)",
      }}
    >
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <div>
          <div
            className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--basil-dark)",
            }}
          >
            ▶ Taste test
          </div>
          <h3
            className="font-black italic text-[18px] text-ink m-0"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Verify the kitchen before service.
          </h3>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="text-[12px] font-semibold px-3.5 py-2 rounded-md disabled:opacity-50"
          style={{
            background: "var(--basil)",
            color: "var(--cream)",
            border: "2px solid var(--ink)",
            boxShadow: running ? undefined : "2px 2px 0 var(--ink)",
            cursor: running ? "wait" : "pointer",
          }}
        >
          {running ? "Tasting…" : "🍴 Run taste test"}
        </button>
      </div>

      <p className="text-[12.5px] text-ink-soft m-0 mb-3 leading-snug">
        Walks the full remediation pipeline without actually opening a
        PR — checks the GitHub token, verifies you can read AND push to
        the configured repo, and dry-run-pushes a branch to confirm git
        auth works end-to-end. Run this <strong>before</strong> a real
        scan if you&rsquo;ve never opened a PR with Oh Pen Testing — it
        catches every misconfiguration we&rsquo;ve seen in 30 seconds
        instead of after a 10-minute scan + 21 failed remediations.
      </p>

      {result && (
        <div
          className="rounded-lg p-3 mt-2"
          style={{
            background: result.ok ? "#E4F0DF" : "#FBE4E0",
            border: `2px solid ${result.ok ? "var(--basil)" : "var(--sauce)"}`,
          }}
        >
          <div
            className="text-[11px] font-bold tracking-[0.15em] uppercase mb-2"
            style={{
              fontFamily: "var(--font-mono)",
              color: result.ok ? "var(--basil-dark)" : "var(--sauce-dark)",
            }}
          >
            {result.ok ? "✓ Kitchen ready to serve" : "✖ Something's off"}
            {result.authenticatedAs && (
              <span
                className="ml-2 opacity-80"
                style={{ textTransform: "none", letterSpacing: "0" }}
              >
                — auth as {result.authenticatedAs}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {result.steps.map((step, i) => (
              <div
                key={i}
                className="text-[12.5px] leading-snug"
                style={{ display: "flex", gap: "8px" }}
              >
                <span
                  className="shrink-0 font-bold"
                  style={{
                    color:
                      step.status === "ok"
                        ? "var(--basil-dark)"
                        : "var(--sauce-dark)",
                  }}
                  aria-hidden
                >
                  {step.status === "ok" ? "✓" : "✖"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{step.name}.</strong>{" "}
                  <span style={{ color: "var(--ink)" }}>{step.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
