"use client";

import { useState } from "react";
import { remediateAction } from "./actions";

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
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function onRemediate() {
    setPending(true);
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
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Severity: {severity} · Autonomy: {autonomy}
      </div>
      {canRemediate.allowed ? (
        <button
          onClick={onRemediate}
          disabled={pending}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Remediating…" : "Remediate now (Marinara 🍅)"}
        </button>
      ) : (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Web remediation disabled:</strong> {canRemediate.reason}
        </div>
      )}
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
