"use client";

import { useState, useTransition } from "react";
import { approveAction, rejectAction } from "./actions";

export function ApproveButton({ issueId }: { issueId: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErr(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => run(() => approveAction(issueId))}
        disabled={pending}
        className="px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700"
      >
        {pending ? "Approving…" : "Approve"}
      </button>
      <button
        onClick={() => run(() => rejectAction(issueId))}
        disabled={pending}
        className="px-3 py-1.5 rounded border border-slate-300 text-sm disabled:opacity-50 hover:bg-slate-50"
      >
        Reject
      </button>
      {err && <span className="text-xs text-red-700 ml-2">{err}</span>}
    </div>
  );
}
