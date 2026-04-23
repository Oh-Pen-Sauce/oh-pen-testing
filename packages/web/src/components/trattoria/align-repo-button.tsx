"use client";

import { useState, useTransition } from "react";
import { alignRepoWithScanTargetAction } from "../../app/setup/assistant-actions";

/**
 * One-click "Fix: use <detected> instead" button for the scan-target
 * banner. When the banner detects that `config.git.repo` doesn't
 * match the actual git origin of the scan folder, clicking this
 * rewrites `git.repo` to match — so PRs will land on the same repo
 * the scanner is reading from.
 *
 * Refuses gracefully (error toast) if no GitHub origin is detectable,
 * so the user gets a real message instead of a mysterious no-op.
 */
export function AlignRepoButton({
  detectedRepo,
}: {
  detectedRepo: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function fix() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await alignRepoWithScanTargetAction();
        if (!res.ok) {
          setError(res.detail);
          return;
        }
        // Hard reload so every piece of server-rendered copy (banner,
        // header chips, sidebar) reflects the new git.repo immediately.
        window.location.reload();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={fix}
        disabled={pending}
        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md ml-2 disabled:opacity-50"
        style={{
          background: "var(--sauce)",
          color: "var(--cream)",
          border: "1.5px solid var(--ink)",
          fontFamily: "var(--font-mono)",
          cursor: pending ? "wait" : "pointer",
        }}
        title={`One click: rewrites git.repo in config.yml to ${detectedRepo} so PRs land on the same repo you're scanning.`}
      >
        {pending ? "fixing…" : `⚡ Use ${detectedRepo} instead`}
      </button>
      {error && (
        <span
          className="ml-2 text-[11px]"
          style={{ color: "var(--sauce-dark)", fontFamily: "var(--font-mono)" }}
        >
          ✖ {error}
        </span>
      )}
    </>
  );
}
