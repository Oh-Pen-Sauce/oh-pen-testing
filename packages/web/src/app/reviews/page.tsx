import Link from "next/link";
import { listIssues, safeLoadConfig } from "../../lib/repo";
import { SeverityPill } from "../../components/trattoria/severity-pill";
import { PageHeader } from "../../components/trattoria/page-header";
import { ApproveButton } from "./approve-button";
import { AGENTS, agentById } from "../../components/trattoria/agents";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [issues, config] = await Promise.all([listIssues(), safeLoadConfig()]);
  const pending = issues.filter((i) => i.status === "pending_approval");
  const autonomy = config?.agents.autonomy ?? "—";

  return (
    <div>
      <PageHeader
        kicker="03 — Tavolo del Capo"
        title={<>Reviews</>}
        sub={
          <>
            Issues where an agent has paused and is waiting on your call.
            Autonomy mode:{" "}
            <code
              className="px-1.5 py-0.5 rounded"
              style={{ background: "var(--parmesan)" }}
            >
              {autonomy}
            </code>
          </>
        }
      />

      {/* Filter chip row — non-interactive for now, matches the design */}
      <div className="flex gap-2.5 mb-5">
        <Chip active>{pending.length} waiting</Chip>
        <Chip>Any severity</Chip>
        <Chip>All agents</Chip>
      </div>

      {pending.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((issue) => {
            const gateComment = [...issue.comments]
              .reverse()
              .find((c) => c.text.toLowerCase().includes("autonomy gate"));
            const agent = resolveAgent(issue.discovered_by);
            return (
              <div
                key={issue.id}
                className="rounded-xl p-[22px]"
                style={{
                  background: "var(--cream-soft)",
                  border: "2px solid var(--ink)",
                  boxShadow: `4px 4px 0 ${agent?.color ?? "var(--sauce)"}`,
                }}
              >
                <div className="flex gap-4 items-start">
                  {/* Agent avatar */}
                  <div className="text-center shrink-0">
                    <div
                      className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-[30px]"
                      style={{
                        background: agent?.color ?? "var(--sauce)",
                        border: "2.5px solid var(--ink)",
                        boxShadow: "2px 2px 0 var(--ink)",
                      }}
                      aria-hidden
                    >
                      {agent?.emoji ?? "🍝"}
                    </div>
                    <div
                      className="text-[11px] font-bold italic mt-1.5 text-ink"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {agent?.name ?? "Scanner"}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-2 gap-3">
                      <h3
                        className="m-0 font-black text-[20px] text-ink flex items-center gap-2"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        <Link
                          href={`/issue/${issue.id}`}
                          className="hover:underline"
                        >
                          {issue.id} · {issue.title}
                        </Link>
                      </h3>
                      <span
                        className="text-[10px] text-ink-soft shrink-0"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {issue.location.file}:{issue.location.line_range[0]}
                      </span>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <SeverityPill severity={issue.severity} />
                      {issue.owasp_category && (
                        <Tag>{issue.owasp_category}</Tag>
                      )}
                      {issue.cwe.slice(0, 2).map((c) => (
                        <Tag key={c}>{c}</Tag>
                      ))}
                    </div>

                    {/* speech bubble with gate reason */}
                    <div
                      className="px-4 py-3 mb-3.5 rounded-[10px]"
                      style={{
                        background: "var(--cream)",
                        border: "2px solid var(--ink)",
                        fontStyle: "italic",
                        fontFamily: "var(--font-display)",
                        fontSize: 15,
                        lineHeight: 1.5,
                        color: "var(--ink)",
                      }}
                    >
                      <span
                        className="font-black mr-1"
                        style={{ color: agent?.color ?? "var(--sauce)" }}
                        aria-hidden
                      >
                        “
                      </span>
                      {gateComment
                        ? gateComment.text
                        : issue.evidence.analysis}
                      <span
                        className="font-black ml-1"
                        style={{ color: agent?.color ?? "var(--sauce)" }}
                        aria-hidden
                      >
                        ”
                      </span>
                    </div>

                    <ApproveButton issueId={issue.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl text-center py-12 px-6"
      style={{
        background: "var(--cream-soft)",
        border: "2.5px dashed var(--ink)",
      }}
    >
      <div className="text-[32px] mb-2" aria-hidden>
        🌿
      </div>
      <div
        className="font-black italic text-[22px] text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Nothing waiting.
      </div>
      <div className="text-[14px] text-ink-soft mt-1">
        Agents are clear to proceed.
      </div>
    </div>
  );
}

function Chip({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className="px-3.5 py-1.5 rounded-full text-[12px] font-bold"
      style={{
        background: active ? "var(--sauce)" : "var(--cream-soft)",
        color: active ? "var(--cream)" : "var(--ink)",
        border: "2px solid var(--ink)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-[3px] rounded"
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

function resolveAgent(discoveredBy?: string) {
  if (!discoveredBy) return AGENTS[0];
  const id = discoveredBy.replace(/^playbook:/, "").split("/")[0] ?? "";
  if (/(secret|inject|upload|redirect)/i.test(id))
    return agentById("marinara");
  if (/(crypto|tls|jwt|cookie)/i.test(id)) return agentById("carbonara");
  if (/(auth|access|session|broken)/i.test(id)) return agentById("alfredo");
  if (/(sca|deps|cve|depend)/i.test(id)) return agentById("pesto");
  return agentById("marinara");
}
