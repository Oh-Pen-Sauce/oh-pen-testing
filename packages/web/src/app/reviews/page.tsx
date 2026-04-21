import Link from "next/link";
import { listIssues, safeLoadConfig } from "../../lib/repo";
import { SeverityBadge } from "../../components/severity-badge";
import { ApproveButton } from "./approve-button";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [issues, config] = await Promise.all([listIssues(), safeLoadConfig()]);
  const pending = issues.filter((i) => i.status === "pending_approval");
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Reviews</h1>
      <p className="text-slate-600 mb-6">
        Issues where an agent has paused and is waiting on your call.
        Autonomy mode:{" "}
        <code className="bg-slate-100 px-1 rounded text-sm">
          {config?.agents.autonomy ?? "—"}
        </code>
      </p>

      {pending.length === 0 ? (
        <div className="rounded border border-slate-200 bg-white p-6 text-center text-slate-500">
          Nothing waiting. Agents are clear to proceed.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((issue) => {
            const gateComment = [...issue.comments]
              .reverse()
              .find((c) => c.text.toLowerCase().includes("autonomy gate"));
            return (
              <div
                key={issue.id}
                className="rounded-lg border border-amber-200 bg-amber-50/30 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={issue.severity} />
                      <span className="text-xs font-mono text-slate-500">
                        {issue.id}
                      </span>
                      {issue.assignee && (
                        <span className="text-xs text-slate-500">
                          → {issue.assignee}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/issue/${issue.id}`}
                      className="font-medium hover:underline block truncate"
                    >
                      {issue.title}
                    </Link>
                    {gateComment && (
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="text-amber-800">Gate:</span>{" "}
                        {gateComment.text}
                      </p>
                    )}
                  </div>
                  <ApproveButton issueId={issue.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
