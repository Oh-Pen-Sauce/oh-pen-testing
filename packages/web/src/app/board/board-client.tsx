"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { Issue, IssueStatus } from "@oh-pen-testing/shared";
import {
  changeIssueStatusAction,
  deleteIssueAction,
  deleteAllIssuesAction,
  fetchIssueAction,
  fetchIssueSnippetAction,
  type IssueSnippet,
} from "./actions";
import {
  remediateAction,
  approveAndRemediateAction,
} from "../issue/[id]/actions";
import { BOARD_COLUMNS } from "./columns";
import { SeverityPill } from "../../components/trattoria/severity-pill";
import { SEVERITY_STYLE, agentById } from "../../components/trattoria/agents";

interface Column {
  status: IssueStatus;
  label: string;
  issues: Issue[];
}

// Italian kitchen subtitles per column — copy lifted from the handoff.
const COLUMN_NOTE: Record<string, string> = {
  backlog: "fresh from the oven",
  ready: "plated, waiting",
  in_progress: "simmering",
  pending_approval: "tasting",
  in_review: "second opinion",
  verified: "chef's kiss",
  done: "buon appetito",
  wont_fix: "off the menu",
};

export function BoardClient({ columns }: { columns: Column[] }) {
  const [selected, setSelected] = useState<Issue | null>(null);
  const [pending, startTransition] = useTransition();
  const totalIssues = columns.reduce((sum, c) => sum + c.issues.length, 0);

  function clearAll() {
    if (
      !confirm(
        `Delete ALL ${totalIssues} issues? This is irreversible (there's no trash). Usually only makes sense during beta testing when you want to re-run scans from a clean slate.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteAllIssuesAction();
      alert(`Cleared ${res.deleted} issue${res.deleted === 1 ? "" : "s"}.`);
    });
  }

  return (
    <>
      {/* Bulk clear — only shown when there's actually something to clear.
          Most useful during beta testing when re-running scans keeps
          creating "ghost" duplicates the cross-scan dedup hasn't caught
          (new playbook, schema change, etc.). */}
      {totalIssues > 0 && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-40"
            style={{
              background: "transparent",
              color: "var(--sauce-dark)",
              border: "1.5px solid var(--sauce)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {pending ? "clearing…" : `🗑 clear all ${totalIssues}`}
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {columns.map((col) => (
          <div
            key={col.status}
            className="rounded-xl p-3 min-h-[220px]"
            style={{
              background: "var(--cream-soft)",
              border: "2px solid var(--ink)",
              boxShadow:
                col.issues.length > 0 ? "3px 3px 0 var(--sauce)" : undefined,
            }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <h4
                className="m-0 text-base font-black italic text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {col.label}
              </h4>
              <span
                className="text-[11px] font-bold px-2 py-[2px] rounded-full"
                style={{ background: "var(--ink)", color: "var(--cream)" }}
              >
                {col.issues.length}
              </span>
            </div>
            <div
              className="text-[10px] italic text-ink-soft mb-2.5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {COLUMN_NOTE[col.status] ?? ""}
            </div>
            <div className="flex flex-col gap-2">
              {col.issues.map((issue) => (
                <BoardCard
                  key={issue.id}
                  issue={issue}
                  onSelect={() => setSelected(issue)}
                />
              ))}
              {col.issues.length === 0 && (
                <div className="text-[11px] text-center italic text-ink-soft py-4">
                  {col.status === "wont_fix" ? "🙅 niente" : "empty plate"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <IssuePanel
          // Re-key on issue id so the panel resets its internal
          // state (action result, snippet) when the user clicks a
          // different card without closing first.
          key={selected.id}
          issue={selected}
          onClose={() => setSelected(null)}
          onChange={async (status) => {
            // Status change is a non-destructive metadata update —
            // keep the panel open so the user can keep reading or
            // run another action. Optimistically update local state.
            await changeIssueStatusAction(selected.id, status);
            setSelected({ ...selected, status });
          }}
          onDelete={async () => {
            if (
              !confirm(
                `Delete ${selected.id}? This removes the issue file from .ohpentesting/issues/ — no trash, no undo. Use "Won't fix" status if you just want to hide it.`,
              )
            )
              return;
            await deleteIssueAction(selected.id);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}

function BoardCard({
  issue,
  onSelect,
}: {
  issue: Issue;
  onSelect: () => void;
}) {
  const sev = SEVERITY_STYLE[issue.severity];
  const agent = agentFromIssue(issue);
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-md p-2.5 transition-transform hover:-translate-y-px"
      style={{
        background: "var(--cream)",
        border: "1.5px solid var(--ink)",
        borderLeft: `4px solid ${sev.border}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <SeverityPill severity={issue.severity} size="sm" />
        <span
          className="text-[10px] text-ink-soft"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {issue.id}
        </span>
      </div>
      <div className="text-[12.5px] font-semibold leading-tight text-ink line-clamp-2">
        {issue.title}
      </div>
      <div className="flex justify-between items-center mt-1.5 gap-1.5">
        <code
          className="text-[10px] text-ink-soft bg-transparent truncate flex-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {issue.location.file}
        </code>
        {/* PR-opened badge — small, scannable visual cue that the
            agent has already cooked a remediation for this card.
            Hovering reveals the URL. */}
        {issue.linked_pr && (
          <span
            className="text-[9px] font-bold tracking-[0.05em] uppercase px-1.5 py-[1px] rounded shrink-0"
            style={{
              background: "#E4F0DF",
              color: "var(--basil-dark)",
              border: "1px solid var(--basil)",
              fontFamily: "var(--font-mono)",
            }}
            title={`PR open: ${issue.linked_pr}`}
            aria-label="PR opened"
          >
            ✓ PR
          </span>
        )}
        {agent && (
          <span
            className="text-[12px] shrink-0"
            aria-label={agent.name}
            title={agent.name}
          >
            {agent.emoji}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Slide-in panel — self-contained issue detail with inline actions.
 *
 * Used to be a thin shell that linked out to /issue/[id] for the
 * actual approve/remediate buttons. Reviewers had to navigate away
 * just to click "open a PR", which broke the kanban flow. Now the
 * panel:
 *
 *   - Shows everything you need to triage one issue (title,
 *     severity, impact, code snippet, AI analysis, blame age if
 *     known, existing PR if open)
 *   - Has the right context-sensitive primary action button right
 *     there: "Approve & open PR" for pending_approval, "Remediate
 *     now" for backlog/ready, "View PR ↗" once the PR is open
 *   - Runs that action inline — spinner, then green "PR opened
 *     #1234 ↗" panel or red error — without closing the slide-in
 *   - Re-fetches the issue from the server post-action so the slide
 *     reflects the new status without a full page reload
 *
 * The status-change pills + delete are still here, but tucked into
 * a "more actions" disclosure so they don't compete with the
 * primary CTA.
 */
function IssuePanel({
  issue: initialIssue,
  onClose,
  onChange,
  onDelete,
}: {
  issue: Issue;
  onClose: () => void;
  onChange: (status: IssueStatus) => void;
  onDelete: () => void;
}) {
  const [issue, setIssue] = useState<Issue>(initialIssue);
  const [snippet, setSnippet] = useState<IssueSnippet | null>(null);
  const [snippetLoading, setSnippetLoading] = useState(true);
  const [running, setRunning] = useState<null | "remediate" | "approve">(null);
  const [result, setResult] = useState<
    | { ok: true; prUrl: string; prNumber: number }
    | { ok: false; error: string }
    | null
  >(null);
  const [showMore, setShowMore] = useState(false);

  // Fetch the code snippet on first open. Cheap — it's just file slice
  // I/O — but we keep it lazy so the kanban itself stays snappy.
  useEffect(() => {
    let cancelled = false;
    setSnippetLoading(true);
    fetchIssueSnippetAction(issue.id)
      .then((s) => {
        if (!cancelled) {
          setSnippet(s);
          setSnippetLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSnippetLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only refetch if the user opens a different issue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id]);

  // Refresh the issue state from the server. Called after any
  // action that mutates the issue, so the panel always reflects
  // disk truth without forcing a navigation.
  async function refreshIssue() {
    const fresh = await fetchIssueAction(issue.id);
    if (fresh) setIssue(fresh);
  }

  async function onRemediate() {
    setResult(null);
    setRunning("remediate");
    try {
      const res = await remediateAction(issue.id);
      setResult({ ok: true, prUrl: res.prUrl, prNumber: res.prNumber });
      await refreshIssue();
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
      // Even on error the agent may have updated the issue (e.g.
      // pushed it to pending_approval). Refresh so the UI reflects
      // the truth.
      await refreshIssue();
    } finally {
      setRunning(null);
    }
  }

  async function onApproveAndRemediate() {
    setResult(null);
    setRunning("approve");
    try {
      const res = await approveAndRemediateAction(issue.id);
      setResult({ ok: true, prUrl: res.prUrl, prNumber: res.prNumber });
      await refreshIssue();
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
      await refreshIssue();
    } finally {
      setRunning(null);
    }
  }

  // Pick the right primary CTA based on status.
  //   pending_approval → green "Approve & open PR" (bypasses gate)
  //   backlog/ready    → red "Remediate now" (gate still applies)
  //   in_progress      → disabled spinner
  //   in_review        → no remediate button; "View PR ↗" already shown
  //   verified/done    → no remediate button
  //   wont_fix         → no remediate button
  const primaryAction: null | {
    label: string;
    icon: string;
    bg: string;
    onClick: () => void;
    title?: string;
  } = (() => {
    if (running === "remediate") {
      return {
        label: "Remediating…",
        icon: "🍅",
        bg: "var(--ink-soft)",
        onClick: () => {},
      };
    }
    if (running === "approve") {
      return {
        label: "Approving + opening PR…",
        icon: "🍅",
        bg: "var(--ink-soft)",
        onClick: () => {},
      };
    }
    if (issue.status === "pending_approval") {
      return {
        label: "Approve & open PR",
        icon: "✓",
        bg: "var(--basil-dark)",
        onClick: onApproveAndRemediate,
        title: "Bypasses the autonomy gate for this one issue and runs the agent now.",
      };
    }
    if (issue.status === "backlog" || issue.status === "ready") {
      return {
        label: "Remediate now",
        icon: "🚀",
        bg: "var(--sauce)",
        onClick: onRemediate,
        title: "Runs the agent. Will gate for approval if the issue is risky and you're not in YOLO.",
      };
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 flex justify-end z-50"
      style={{ background: "rgba(34,26,20,0.35)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full overflow-y-auto p-6"
        style={{
          background: "var(--cream-soft)",
          borderLeft: "2.5px solid var(--ink)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <span
              className="text-[11px] text-ink-soft"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {issue.id} · {issue.status}
            </span>
            <h2
              className="text-xl font-black italic mt-1 text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {issue.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-soft hover:text-ink shrink-0 ml-4 text-lg"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <SeverityPill severity={issue.severity} />
          {issue.owasp_category && <Tag>{issue.owasp_category}</Tag>}
          {issue.cwe.map((c) => (
            <Tag key={c}>{c}</Tag>
          ))}
          <code
            className="text-[10px] px-2 py-[3px] rounded"
            style={{
              background: "var(--cream)",
              border: "1px solid var(--ink)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {issue.location.file}:{issue.location.line_range[0]}
          </code>
        </div>

        {/* Impact ribbon — "what happens if we don't fix this." */}
        {issue.vulnerability_impact && (
          <div
            className="rounded-lg p-3 mb-4 text-[13px] leading-snug"
            style={{
              background: "#FBE4E0",
              border: "1.5px solid var(--sauce)",
              whiteSpace: "pre-wrap",
            }}
          >
            <div
              className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--sauce-dark)",
              }}
            >
              ⚠ What this could lead to
            </div>
            {issue.vulnerability_impact}
          </div>
        )}

        {/* Code snippet — the actual matched lines, with the finding
            range highlighted. Lazy-loaded after the panel opens. */}
        {snippet ? (
          <div className="mb-4">
            <div className="kicker mb-1">Code · matched lines</div>
            <pre
              className="text-[11px] rounded-md p-2.5 overflow-x-auto m-0"
              style={{
                background: "var(--ink)",
                color: "var(--cream)",
                fontFamily: "var(--font-mono)",
                border: "2px solid var(--ink)",
                lineHeight: 1.5,
              }}
            >
              {snippet.lines.map((line, i) => {
                const lineNo = snippet.startLine + i;
                const inRange =
                  lineNo >= snippet.highlight[0] &&
                  lineNo <= snippet.highlight[1];
                return (
                  <div
                    key={i}
                    style={{
                      background: inRange
                        ? "rgba(200,50,30,0.25)"
                        : "transparent",
                    }}
                  >
                    <span
                      className="mr-2.5 select-none opacity-50"
                      style={{ color: "var(--cream)" }}
                    >
                      {String(lineNo).padStart(4, " ")}
                    </span>
                    {line || " "}
                  </div>
                );
              })}
            </pre>
          </div>
        ) : snippetLoading ? (
          <div
            className="text-[11px] text-ink-soft mb-4"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            loading code…
          </div>
        ) : null}

        {/* AI analysis — short paragraph; the long version is on the
            full-detail page. */}
        <div className="mb-4">
          <div className="kicker mb-1">Analysis</div>
          <p className="text-[13px] text-ink m-0 leading-snug">
            {issue.evidence.analysis}
          </p>
        </div>

        {/* Fix made + PR link if the agent's already opened one. */}
        {issue.linked_pr && (
          <div
            className="rounded-lg p-3 mb-4 text-[13px] leading-snug"
            style={{
              background: "#E4F0DF",
              border: "1.5px solid var(--basil)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <div
                className="text-[10px] font-bold tracking-[0.15em] uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--basil-dark)",
                }}
              >
                ✓ Fix made — PR open
              </div>
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
              <div style={{ whiteSpace: "pre-wrap" }}>
                {issue.fix_description}
              </div>
            ) : (
              <div className="text-ink-soft text-[12px]">
                Agent opened a PR. Open the PR for the full fix description.
              </div>
            )}
          </div>
        )}

        {/* Inline action result — appears RIGHT after a remediate run.
            Stays visible until the user closes the panel or runs
            something else, so they don't miss it. */}
        {result && result.ok && (
          <div
            className="rounded-lg p-3 mb-4 text-[13px]"
            style={{
              background: "#E4F0DF",
              border: "2px solid var(--basil)",
            }}
          >
            <div
              className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--basil-dark)",
              }}
            >
              ✓ PR opened
            </div>
            <div className="text-ink mb-1">
              The agent committed the fix and opened a pull request on
              GitHub.
            </div>
            <a
              href={result.prUrl}
              target="_blank"
              rel="noreferrer"
              className="underline text-[12.5px] break-all"
              style={{
                color: "var(--sauce)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {result.prUrl}
            </a>
          </div>
        )}
        {result && !result.ok && (
          <div
            className="rounded-lg p-3 mb-4 text-[13px]"
            style={{
              background: "#FBE4E0",
              border: "2px solid var(--sauce)",
            }}
          >
            <div
              className="text-[10px] font-bold tracking-[0.15em] uppercase mb-1"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--sauce-dark)",
              }}
            >
              ✖ Remediation failed
            </div>
            <div className="text-ink" style={{ whiteSpace: "pre-wrap" }}>
              {result.error}
            </div>
          </div>
        )}

        {/* Primary CTA — context-sensitive based on issue.status. */}
        {primaryAction && (
          <div className="mb-4">
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={running !== null}
              title={primaryAction.title}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-[14px] font-bold rounded-lg disabled:opacity-70"
              style={{
                background: primaryAction.bg,
                color: "var(--cream)",
                border: "2.5px solid var(--ink)",
                boxShadow:
                  running === null ? "3px 3px 0 var(--ink)" : undefined,
                cursor: running !== null ? "wait" : "pointer",
                fontFamily: "var(--font-display)",
                letterSpacing: "0.02em",
              }}
            >
              <span aria-hidden>{primaryAction.icon}</span>
              {primaryAction.label}
            </button>
            {issue.status === "pending_approval" && running === null && (
              <div
                className="text-[11px] text-ink-soft mt-2 leading-snug"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Auto-remediation gated this issue (
                {issue.severity === "critical"
                  ? "critical severity"
                  : "matched an approval trigger"}
                ). Clicking above bypasses the gate for this one issue and
                runs the agent right now.
              </div>
            )}
          </div>
        )}

        {/* Secondary actions — status-change pills + delete + full
            detail link, tucked behind a disclosure so they don't
            compete with the primary CTA. */}
        <div
          className="mt-2 pt-2"
          style={{ borderTop: "1px dashed rgba(34,26,20,0.2)" }}
        >
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-[11px] underline"
            style={{
              color: "var(--ink-soft)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {showMore ? "▾ Hide more actions" : "▸ More actions"}
          </button>
          {showMore && (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <div className="kicker mb-1.5">Change status</div>
                <div className="flex flex-wrap gap-1.5">
                  {BOARD_COLUMNS.map((col) => (
                    <button
                      key={col.status}
                      disabled={col.status === issue.status}
                      onClick={() => onChange(col.status)}
                      className="text-[11px] px-2 py-[3px] rounded disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "var(--cream)",
                        border: "1.5px solid var(--ink)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Link
                  href={`/issue/${issue.id}`}
                  className="text-[12px] underline"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Full detail page →
                </Link>
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-md"
                  style={{
                    background: "transparent",
                    color: "var(--sauce-dark)",
                    border: "1.5px solid var(--sauce)",
                    fontFamily: "var(--font-mono)",
                  }}
                  title="Deletes the issue file from disk. Use 'Won't fix' to hide instead."
                >
                  🗑 delete issue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="inline text-ink-soft">{k}:</dt>{" "}
      <dd className="inline">{v}</dd>
    </div>
  );
}

/**
 * Resolve which agent's emoji to render on a card.
 *
 * Two-stage lookup:
 *   1. If issue.assignee is set (the agent has already picked this up
 *      during a remediation pass), use that — it's the source of
 *      truth straight from the agent pool.
 *   2. Otherwise predict who WILL pick it up using the same rules
 *      pickAgentForPlaybook() in core uses, so the kanban shows the
 *      correct agent even before remediation runs.
 *
 * The previous heuristic split discovered_by on "/" and only looked
 * at the FIRST segment ("owasp", "cwe-top-25", "iac", "wstg"), none
 * of which match agent specialty regexes — so every card defaulted
 * to Marinara. This is mirror of pickAgentForPlaybook in
 * packages/core/src/agent/agents.ts; if the rules diverge, fix both.
 */
function agentFromIssue(issue: Issue) {
  // 1. Real assignment — once an agent has touched the issue.
  if (issue.assignee && issue.assignee in AGENT_BY_ID) {
    return agentById(issue.assignee);
  }
  // 2. Predicted assignment — based on full playbook id + OWASP cat.
  const playbookId = (issue.remediation?.strategy ?? "").toLowerCase();
  const cat = (issue.owasp_category ?? "").toLowerCase();
  if (
    playbookId.includes("inject") ||
    playbookId.includes("xss") ||
    playbookId.includes("xxe") ||
    playbookId.includes("command") ||
    playbookId.includes("secrets") ||
    cat.includes("a03")
  ) {
    return agentById("marinara");
  }
  if (
    playbookId.includes("crypto") ||
    playbookId.includes("hash") ||
    playbookId.includes("tls") ||
    playbookId.includes("random") ||
    cat.includes("a02")
  ) {
    return agentById("carbonara");
  }
  if (
    playbookId.includes("auth") ||
    playbookId.includes("access-control") ||
    playbookId.includes("session") ||
    playbookId.includes("cors") ||
    cat.includes("a01") ||
    cat.includes("a07")
  ) {
    return agentById("alfredo");
  }
  if (
    playbookId.includes("sca") ||
    playbookId.includes("component") ||
    playbookId.includes("deserial") ||
    playbookId.includes("sri") ||
    cat.includes("a06") ||
    cat.includes("a08")
  ) {
    return agentById("pesto");
  }
  return agentById("marinara");
}

const AGENT_BY_ID: Record<string, true> = {
  marinara: true,
  carbonara: true,
  alfredo: true,
  pesto: true,
};
