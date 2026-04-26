"use client";

import { useState } from "react";
import {
  remediateAction,
  approveAndRemediateAction,
  verifyAction,
} from "./actions";

/**
 * Issue-detail action bar. Mirrors the slide-in panel's primary CTA
 * logic so the two surfaces stay coherent — clicking from /board's
 * slide-in or from /issue/[id] should give the same options for the
 * same issue.
 */
export function IssueActions({
  issueId,
  status,
  canRemediate,
  severity,
  autonomy,
}: {
  issueId: string;
  /** Current issue status — drives which primary CTA we render. */
  status: string;
  canRemediate: { allowed: boolean; reason?: string };
  severity: string;
  autonomy: string;
}) {
  const [pending, setPending] = useState<
    null | "remediate" | "approve" | "verify"
  >(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function onRemediate() {
    setPending("remediate");
    setResult(null);
    try {
      const res = await remediateAction(issueId);
      setResult({ ok: true, message: `✓ PR opened: ${res.prUrl}` });
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setPending(null);
    }
  }

  async function onApprove() {
    setPending("approve");
    setResult(null);
    try {
      const res = await approveAndRemediateAction(issueId);
      setResult({
        ok: true,
        message: `✓ Approved + PR opened: ${res.prUrl}`,
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

  // pending_approval issues need bypass-the-gate semantics, so they
  // get a separate CTA. Everything else uses the standard remediate
  // button (which still goes through the autonomy gate).
  const isPendingApproval = status === "pending_approval";
  const showRemediate =
    !isPendingApproval &&
    (status === "backlog" || status === "ready") &&
    canRemediate.allowed;
  const showVerify =
    status === "in_review" || status === "verified" || status === "in_progress";

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Severity: {severity} · Autonomy: {autonomy} · Status: {status}
      </div>
      <div className="flex flex-wrap gap-2">
        {isPendingApproval && (
          <button
            onClick={onApprove}
            disabled={pending !== null}
            title="Bypass the autonomy gate for this one issue and run the agent now."
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{
              background: "var(--basil-dark, #2B5A27)",
              color: "white",
            }}
          >
            {pending === "approve"
              ? "Approving + opening PR…"
              : "✓ Approve & open PR"}
          </button>
        )}
        {showRemediate && (
          <button
            onClick={onRemediate}
            disabled={pending !== null}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {pending === "remediate"
              ? "Remediating…"
              : "🚀 Remediate now (Marinara 🍅)"}
          </button>
        )}
        {!isPendingApproval && !showRemediate && !canRemediate.allowed && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex-1">
            <strong>Web remediation disabled:</strong> {canRemediate.reason}
          </div>
        )}
        {showVerify && (
          <button
            onClick={onVerify}
            disabled={pending !== null}
            className="px-4 py-2 rounded bg-slate-700 text-white text-sm font-medium disabled:opacity-50"
            title="Rerun the playbook that found this issue to confirm the fix landed."
          >
            {pending === "verify" ? "Verifying…" : "Verify fix"}
          </button>
        )}
      </div>
      {result && (
        <div
          className={`rounded border p-3 text-sm whitespace-pre-wrap ${
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
