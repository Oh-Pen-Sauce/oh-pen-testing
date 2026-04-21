"use client";

import { useState } from "react";
import { remediateAction, verifyAction } from "./actions";

export function IssueActions({
  issueId,
  canRemediate,
  severity,
  autonomy,
}: {
  issueId: string;
  canRemediate: { allowed: boolean; reason?: string };
  severity: string;
  autonomy: string;
}) {
  const [pending, setPending] = useState<null | "remediate" | "verify">(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function onRemediate() {
    setPending("remediate");
    setResult(null);
    try {
      const res = await remediateAction(issueId);
      setResult({
        ok: true,
        message: `PR opened: ${res.prUrl}`,
      });
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setPending(null);
    }
  }

  async function onVerify() {
    setPending("verify");
    setResult(null);
    try {
      const res = await verifyAction(issueId);
      setResult({
        ok: res.verified,
        message: res.verified
          ? "✓ Verified — 0 hits remaining. Status updated."
          : `⚠ ${res.hitsRemaining} hit(s) still present. Issue stays open.`,
      });
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Severity: {severity} · Autonomy: {autonomy}
      </div>
      <div className="flex flex-wrap gap-2">
        {canRemediate.allowed ? (
          <button
            onClick={onRemediate}
            disabled={pending !== null}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {pending === "remediate"
              ? "Remediating…"
              : "Remediate now (Marinara 🍅)"}
          </button>
        ) : (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex-1">
            <strong>Web remediation disabled:</strong> {canRemediate.reason}
          </div>
        )}
        <button
          onClick={onVerify}
          disabled={pending !== null}
          className="px-4 py-2 rounded bg-slate-700 text-white text-sm font-medium disabled:opacity-50"
          title="Rerun the playbook that found this issue to confirm the fix landed"
        >
          {pending === "verify" ? "Verifying…" : "Verify fix"}
        </button>
      </div>
      {result && (
        <div
          className={`rounded border p-3 text-sm ${
            result.ok
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
