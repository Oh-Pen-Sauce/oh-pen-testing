import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssue, readSourceFileSlice, safeLoadConfig } from "../../../lib/repo";
import { SeverityBadge } from "../../../components/severity-badge";
import { IssueActions } from "./issue-actions";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [issue, config] = await Promise.all([getIssue(id), safeLoadConfig()]);
  if (!issue) notFound();

  let snippet: Awaited<ReturnType<typeof readSourceFileSlice>> | null = null;
  try {
    snippet = await readSourceFileSlice(
      issue.location.file,
      issue.location.line_range[0],
      issue.location.line_range[1],
      5,
    );
  } catch {
    snippet = null;
  }

  const autonomy = config?.agents.autonomy ?? "recommended";
  const canRemediate = canRemediateNow(issue.severity, autonomy);

  return (
    <div>
      <div className="mb-6">
        <Link href="/board" className="text-sm text-slate-500 hover:underline">
          ← Back to board
        </Link>
      </div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="text-xs font-mono text-slate-500">{issue.id}</span>
          <h1 className="text-3xl font-bold mt-1">{issue.title}</h1>
        </div>
        <SeverityBadge severity={issue.severity} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {issue.owasp_category && (
          <span className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200">
            {issue.owasp_category}
          </span>
        )}
        {issue.cwe.map((c) => (
          <span
            key={c}
            className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200"
          >
            {c}
          </span>
        ))}
        <span className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200">
          Status: {issue.status}
        </span>
      </div>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Analysis</h2>
        <p className="text-slate-700">{issue.evidence.analysis}</p>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Code context</h2>
        <div className="text-xs text-slate-500 mb-1 font-mono">
          {issue.location.file}:{issue.location.line_range[0]}–
          {issue.location.line_range[1]}
        </div>
        {snippet ? (
          <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto">
            {snippet.lines.map((line, i) => {
              const lineNo = snippet.startLine + i;
              const inRange =
                lineNo >= issue.location.line_range[0] &&
                lineNo <= issue.location.line_range[1];
              return (
                <div key={i} className={inRange ? "bg-red-500/10" : ""}>
                  <span className="text-slate-500 mr-3 select-none">
                    {String(lineNo).padStart(4, " ")}
                  </span>
                  {line}
                </div>
              );
            })}
          </pre>
        ) : (
          <div className="text-sm text-slate-500">
            Source file no longer available.
          </div>
        )}
      </section>

      {issue.linked_pr && (
        <section className="mb-6">
          <h2 className="font-semibold mb-2">Linked PR</h2>
          <a
            href={issue.linked_pr}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            {issue.linked_pr}
          </a>
        </section>
      )}

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Actions</h2>
        <IssueActions
          issueId={issue.id}
          canRemediate={canRemediate}
          severity={issue.severity}
          autonomy={autonomy}
        />
      </section>
    </div>
  );
}

function canRemediateNow(
  severity: string,
  autonomy: string,
): { allowed: boolean; reason?: string } {
  // M1 ships a half-feature: full agent pool + 3-mode gating is M4.
  if (severity === "critical") {
    return {
      allowed: false,
      reason:
        "Critical issues require the full agent pool (M4). For now, remediate from the CLI with explicit `--agent marinara`.",
    };
  }
  if (autonomy === "careful") {
    return {
      allowed: false,
      reason:
        "Careful mode blocks web-initiated remediation until M4's approval flow.",
    };
  }
  return { allowed: true };
}
