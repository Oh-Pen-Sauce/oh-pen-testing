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

      {issue.blame?.oldest_commit_sha && (
        <BlameTimeline blame={issue.blame} />
      )}

      {/* Evidence/interpretation split (PRD Principle 5): raw scanner
          output on the left is machine-verifiable; AI analysis on the
          right is advisory. Never merged. */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-900 mr-2 align-middle" />
              Scanner output
            </h2>
            <span className="text-xs text-slate-500">machine-verifiable</span>
          </div>
          <dl className="text-xs text-slate-600 space-y-1 mb-3">
            {issue.evidence.rule_id && (
              <div>
                <dt className="inline">Rule:</dt>{" "}
                <dd className="inline font-mono">{issue.evidence.rule_id}</dd>
              </div>
            )}
            <div>
              <dt className="inline">Location:</dt>{" "}
              <dd className="inline font-mono">
                {issue.location.file}:{issue.location.line_range[0]}
                {issue.location.line_range[1] !== issue.location.line_range[0] &&
                  `-${issue.location.line_range[1]}`}
              </dd>
            </div>
            {issue.evidence.match_position && (
              <div>
                <dt className="inline">Match length:</dt>{" "}
                <dd className="inline">
                  {issue.evidence.match_position.length} chars
                </dd>
              </div>
            )}
          </dl>
          {snippet ? (
            <pre className="bg-slate-900 text-slate-100 text-xs rounded p-3 overflow-x-auto">
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

        <section className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600 mr-2 align-middle" />
              AI analysis
            </h2>
            <span className="text-xs text-blue-700">advisory</span>
          </div>
          <p className="text-sm text-slate-700 mb-3">
            {issue.evidence.analysis}
          </p>
          {issue.evidence.ai_reasoning &&
            issue.evidence.ai_reasoning !== issue.evidence.analysis && (
              <details className="text-xs text-slate-600 mb-3">
                <summary className="cursor-pointer hover:text-slate-900">
                  Detailed reasoning
                </summary>
                <p className="mt-2 pl-3 border-l-2 border-blue-200">
                  {issue.evidence.ai_reasoning}
                </p>
              </details>
            )}
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-700">
              Provenance
            </summary>
            <dl className="mt-2 space-y-1 font-mono">
              <div>Model: {issue.evidence.ai_model ?? "unknown"}</div>
              {issue.evidence.ai_confidence && (
                <div>Confidence: {issue.evidence.ai_confidence}</div>
              )}
              <div>Discovered by: {issue.discovered_by}</div>
              <div>Discovered at: {issue.discovered_at}</div>
              <div>Scan: {issue.scan_id}</div>
            </dl>
          </details>
        </section>
      </div>

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
  // Critical + careful: still block from web UI. Everything else: trust the
  // autonomy gate inside runAgent to make the call.
  if (autonomy === "careful") {
    return {
      allowed: false,
      reason:
        "Careful mode blocks web-initiated remediation — run `opt approve --issue <id>` first, or switch to Recommended in settings.",
    };
  }
  if (severity === "critical" && autonomy === "recommended") {
    return {
      allowed: false,
      reason:
        "Critical severity is gated in Recommended mode. Switch to YOLO or Full YOLO in settings, or use `opt remediate` from the CLI after reviewing the plan.",
    };
  }
  return { allowed: true };
}

interface BlameProp {
  oldest_commit_sha: string | null;
  oldest_commit_iso: string | null;
  oldest_commit_author: string | null;
  oldest_commit_summary: string | null;
  age_days: number | null;
  contributors: string[];
}

function BlameTimeline({ blame }: { blame: BlameProp }) {
  if (!blame.oldest_commit_sha) return null;
  const age = humanAge(blame.age_days);
  const banner =
    blame.age_days !== null && blame.age_days > 365 * 2
      ? "bg-red-50 border-red-200 text-red-900"
      : blame.age_days !== null && blame.age_days > 180
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : "bg-slate-50 border-slate-200 text-slate-700";
  return (
    <section className={`mb-6 rounded-lg border p-4 ${banner}`}>
      <h2 className="font-semibold text-sm mb-2">
        <span className="mr-1">🕰️</span> This bug has been here {age}
      </h2>
      <dl className="text-xs space-y-1">
        <div>
          <dt className="inline font-medium">Oldest commit:</dt>{" "}
          <dd className="inline font-mono">
            {blame.oldest_commit_sha?.slice(0, 10)}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Introduced:</dt>{" "}
          <dd className="inline">{blame.oldest_commit_iso?.slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Author:</dt>{" "}
          <dd className="inline">{blame.oldest_commit_author}</dd>
        </div>
        {blame.oldest_commit_summary && (
          <div>
            <dt className="inline font-medium">Commit:</dt>{" "}
            <dd className="inline italic">
              "{blame.oldest_commit_summary}"
            </dd>
          </div>
        )}
        {blame.contributors.length > 0 && (
          <div>
            <dt className="inline font-medium">Contributors to range:</dt>{" "}
            <dd className="inline">{blame.contributors.join(", ")}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function humanAge(days: number | null): string {
  if (days === null) return "an unknown time";
  if (days < 1) return "since today";
  if (days < 2) return "since yesterday";
  if (days < 30) return `for ${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return `for ${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days - years * 365) / 30);
  if (remMonths === 0)
    return `for ${years} year${years === 1 ? "" : "s"}`;
  return `for ${years} year${years === 1 ? "" : "s"}, ${remMonths} month${remMonths === 1 ? "" : "s"}`;
}
