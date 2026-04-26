import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssue, readSourceFileSlice, safeLoadConfig } from "../../../lib/repo";
import { SeverityPill } from "../../../components/trattoria/severity-pill";
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
      <div className="mb-5">
        <Link
          href="/board"
          className="text-sm underline text-ink-soft"
        >
          ← Back to board
        </Link>
      </div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span
            className="text-[11px] text-ink-soft"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {issue.id}
          </span>
          <h1
            className="font-black text-[36px] leading-[1.05] text-ink mt-1"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
            }}
          >
            {issue.title}
          </h1>
        </div>
        <SeverityPill severity={issue.severity} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {issue.owasp_category && <Tag>{issue.owasp_category}</Tag>}
        {issue.cwe.map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
        <Tag>Status: {issue.status}</Tag>
      </div>

      {/* Impact — "what bad thing happens if we don't fix this".
          Sourced from the playbook's `impact` field at scan time, so
          older issues won't have it. Omits cleanly when absent. */}
      {issue.vulnerability_impact && (
        <section
          className="rounded-xl p-5 mb-6"
          style={{
            background: "#FBE4E0",
            border: "2px solid var(--sauce)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] font-bold tracking-[0.15em] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--sauce-dark)",
              }}
            >
              ⚠ What this could lead to
            </span>
          </div>
          <p
            className="text-[14px] leading-relaxed text-ink m-0"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {issue.vulnerability_impact}
          </p>
        </section>
      )}

      {issue.blame?.oldest_commit_sha && (
        <BlameTimeline blame={issue.blame} />
      )}

      {/* Evidence/interpretation split (PRD Principle 5): raw scanner
          output on the left is machine-verifiable; AI analysis on the
          right is advisory. Never merged. */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <section
          className="rounded-xl p-5"
          style={{
            background: "var(--cream-soft)",
            border: "2px solid var(--ink)",
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="kicker">● Scanner output</h2>
            <span className="text-[10px] text-ink-soft">
              machine-verifiable
            </span>
          </div>
          <dl className="text-[12px] text-ink-soft space-y-1 mb-3">
            {issue.evidence.rule_id && (
              <Row
                k="Rule"
                v={
                  <code style={{ fontFamily: "var(--font-mono)" }}>
                    {issue.evidence.rule_id}
                  </code>
                }
              />
            )}
            <Row
              k="Location"
              v={
                <code style={{ fontFamily: "var(--font-mono)" }}>
                  {issue.location.file}:{issue.location.line_range[0]}
                  {issue.location.line_range[1] !==
                    issue.location.line_range[0] &&
                    `-${issue.location.line_range[1]}`}
                </code>
              }
            />
            {issue.evidence.match_position && (
              <Row
                k="Match length"
                v={`${issue.evidence.match_position.length} chars`}
              />
            )}
          </dl>
          {snippet ? (
            <pre
              className="text-[12px] rounded-md p-3 overflow-x-auto"
              style={{
                background: "var(--ink)",
                color: "var(--cream)",
                fontFamily: "var(--font-mono)",
                border: "2px solid var(--ink)",
              }}
            >
              {snippet.lines.map((line, i) => {
                const lineNo = snippet.startLine + i;
                const inRange =
                  lineNo >= issue.location.line_range[0] &&
                  lineNo <= issue.location.line_range[1];
                return (
                  <div
                    key={i}
                    style={{
                      background: inRange
                        ? "rgba(200,50,30,0.22)"
                        : "transparent",
                    }}
                  >
                    <span
                      className="mr-3 select-none opacity-50"
                      style={{ color: "var(--cream)" }}
                    >
                      {String(lineNo).padStart(4, " ")}
                    </span>
                    {line}
                  </div>
                );
              })}
            </pre>
          ) : (
            <div className="text-sm text-ink-soft">
              Source file no longer available.
            </div>
          )}
        </section>

        <section
          className="rounded-xl p-5"
          style={{
            background: "var(--parmesan)",
            border: "2px solid var(--ink)",
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <h2
              className="kicker"
              style={{ color: "var(--sauce-dark)" }}
            >
              ● AI analysis
            </h2>
            <span className="text-[10px] text-ink-soft">advisory</span>
          </div>
          <p className="text-[14px] text-ink mb-3">
            {issue.evidence.analysis}
          </p>
          {issue.evidence.ai_reasoning &&
            issue.evidence.ai_reasoning !== issue.evidence.analysis && (
              <details className="text-[12px] text-ink-soft mb-3">
                <summary
                  className="cursor-pointer"
                  style={{ color: "var(--sauce)" }}
                >
                  Detailed reasoning
                </summary>
                <p
                  className="mt-2 pl-3"
                  style={{ borderLeft: "2px solid var(--ink)" }}
                >
                  {issue.evidence.ai_reasoning}
                </p>
              </details>
            )}
          <details className="text-[11px] text-ink-soft">
            <summary className="cursor-pointer">Provenance</summary>
            <dl
              className="mt-2 space-y-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
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

      {/* Fix made — only meaningful once an agent has opened a PR.
          Combines the AI-authored explanation with a prominent link
          out to the PR. */}
      {issue.linked_pr && (
        <section
          className="rounded-xl p-5 mb-6"
          style={{
            background: "#E4F0DF",
            border: "2px solid var(--basil)",
          }}
        >
          <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.15em] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--basil-dark)",
              }}
            >
              ✓ Fix made — PR open
            </span>
            <a
              href={issue.linked_pr}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-semibold underline"
              style={{ color: "var(--sauce)" }}
            >
              View PR ↗
            </a>
          </div>
          {issue.fix_description ? (
            <p
              className="text-[14px] leading-relaxed text-ink m-0 mb-3"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {issue.fix_description}
            </p>
          ) : (
            <p className="text-[13px] text-ink-soft m-0 mb-3">
              An agent opened a PR for this issue. The fix narrative
              wasn&rsquo;t captured (older issue, pre-narrative-tracking) — see
              the PR description for details.
            </p>
          )}
          <div
            className="text-[11px] mt-2"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--ink-soft)",
              wordBreak: "break-all",
            }}
          >
            {issue.linked_pr}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="kicker mb-2">Actions</h2>
        <IssueActions
          issueId={issue.id}
          status={issue.status}
          canRemediate={canRemediate}
          severity={issue.severity}
          autonomy={autonomy}
        />
      </section>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-1 rounded"
      style={{
        background: "var(--cream)",
        border: "1px solid var(--ink)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="inline font-semibold text-ink">{k}:</dt>{" "}
      <dd className="inline">{v}</dd>
    </div>
  );
}

function canRemediateNow(
  severity: string,
  autonomy: string,
): { allowed: boolean; reason?: string } {
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
  const { bg, border, fg } =
    blame.age_days !== null && blame.age_days > 365 * 2
      ? { bg: "#FBE4E0", border: "#C8321E", fg: "#8F1E10" }
      : blame.age_days !== null && blame.age_days > 180
        ? { bg: "#FBF4D9", border: "#D4A017", fg: "#8C6A05" }
        : { bg: "var(--cream-soft)", border: "var(--ink)", fg: "var(--ink)" };
  return (
    <section
      className="mb-6 rounded-xl p-4"
      style={{ background: bg, border: `2px solid ${border}`, color: fg }}
    >
      <h2 className="font-bold text-[14px] mb-2">
        <span className="mr-1.5" aria-hidden>
          🕰️
        </span>
        This bug has been here {age}
      </h2>
      <dl className="text-[12px] space-y-1">
        <Row
          k="Oldest commit"
          v={
            <code style={{ fontFamily: "var(--font-mono)" }}>
              {blame.oldest_commit_sha?.slice(0, 10)}
            </code>
          }
        />
        <Row k="Introduced" v={blame.oldest_commit_iso?.slice(0, 10)} />
        <Row k="Author" v={blame.oldest_commit_author} />
        {blame.oldest_commit_summary && (
          <Row
            k="Commit"
            v={<em>“{blame.oldest_commit_summary}”</em>}
          />
        )}
        {blame.contributors.length > 0 && (
          <Row
            k="Contributors to range"
            v={blame.contributors.join(", ")}
          />
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
  if (remMonths === 0) return `for ${years} year${years === 1 ? "" : "s"}`;
  return `for ${years} year${years === 1 ? "" : "s"}, ${remMonths} month${
    remMonths === 1 ? "" : "s"
  }`;
}
