"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Issue, IssueStatus } from "@oh-pen-testing/shared";
import {
  changeIssueStatusAction,
  deleteIssueAction,
  deleteAllIssuesAction,
} from "./actions";
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
          issue={selected}
          onClose={() => setSelected(null)}
          onChange={async (status) => {
            await changeIssueStatusAction(selected.id, status);
            setSelected(null);
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
      <div className="flex justify-between items-center mt-1.5">
        <code
          className="text-[10px] text-ink-soft bg-transparent truncate max-w-[160px]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {issue.location.file}
        </code>
        {agent && (
          <span
            className="text-[12px]"
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

function IssuePanel({
  issue,
  onClose,
  onChange,
  onDelete,
}: {
  issue: Issue;
  onClose: () => void;
  onChange: (status: IssueStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex justify-end z-50"
      style={{ background: "rgba(34,26,20,0.35)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg h-full overflow-y-auto p-6"
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
              {issue.id}
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
        </div>

        <dl className="text-sm space-y-1 mb-4">
          <Row
            k="Location"
            v={
              <code style={{ fontFamily: "var(--font-mono)" }}>
                {issue.location.file}:{issue.location.line_range[0]}
              </code>
            }
          />
          <Row k="Status" v={issue.status} />
          {issue.linked_pr && (
            <Row
              k="PR"
              v={
                <a
                  href={issue.linked_pr}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                  style={{ color: "var(--sauce)" }}
                >
                  {issue.linked_pr}
                </a>
              }
            />
          )}
        </dl>

        <div className="mb-4">
          <div className="kicker mb-1">Analysis</div>
          <p className="text-sm text-ink">{issue.evidence.analysis}</p>
        </div>

        <div className="mb-4">
          <div className="kicker mb-2">Change status</div>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLUMNS.map((col) => (
              <button
                key={col.status}
                disabled={col.status === issue.status}
                onClick={() => onChange(col.status)}
                className="text-xs px-2.5 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background:
                    col.status === issue.status
                      ? "var(--cream)"
                      : "var(--cream)",
                  border: "1.5px solid var(--ink)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {col.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mt-4 pt-3" style={{ borderTop: "1px dashed rgba(34,26,20,0.2)" }}>
          <Link
            href={`/issue/${issue.id}`}
            className="text-sm underline"
            style={{ color: "var(--sauce)" }}
          >
            Full detail →
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
            title="Deletes the issue file from disk. Use 'Won't fix' if you only want to hide it."
          >
            🗑 delete issue
          </button>
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

function agentFromIssue(issue: Issue) {
  const id = (issue.discovered_by ?? "")
    .replace(/^playbook:/, "")
    .split("/")[0] ?? "";
  if (/(secret|inject|upload|redirect)/i.test(id)) return agentById("marinara");
  if (/(crypto|tls|jwt|cookie)/i.test(id)) return agentById("carbonara");
  if (/(auth|access|session|broken)/i.test(id)) return agentById("alfredo");
  if (/(sca|deps|cve|depend)/i.test(id)) return agentById("pesto");
  return agentById("marinara");
}
