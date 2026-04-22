"use client";

import { useState, useTransition } from "react";
import { approveAction, rejectAction } from "./actions";
import { Btn } from "../../components/trattoria/button";

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
    <div className="flex items-center gap-2 flex-wrap">
      <Btn
        variant="basil"
        icon="✓"
        disabled={pending}
        onClick={() => run(() => approveAction(issueId))}
      >
        {pending ? "Approving…" : "Approve & open PR"}
      </Btn>
      <Btn
        variant="ghost"
        icon="✖"
        disabled={pending}
        onClick={() => run(() => rejectAction(issueId))}
      >
        Reject
      </Btn>
      {err && (
        <span
          className="text-xs ml-2"
          style={{ color: "var(--sauce-dark)" }}
        >
          {err}
        </span>
      )}
    </div>
  );
}
