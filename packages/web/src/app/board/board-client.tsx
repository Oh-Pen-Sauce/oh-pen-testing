"use client";

import Link from "next/link";
import { useState } from "react";
import type { Issue, IssueStatus, Severity } from "@oh-pen-testing/shared";
import { changeIssueStatusAction } from "./actions";
import { BOARD_COLUMNS } from "./columns";
import { SeverityBadge } from "../../components/severity-badge";
export { SeverityBadge };

interface Column {
  status: IssueStatus;
  label: string;
  issues: Issue[];
}

export function BoardClient({ columns }: { columns: Column[] }) {
  const [selected, setSelected] = useState<Issue | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {columns.map((col) => (
          <div
            key={col.status}
            className="rounded-lg bg-slate-100 p-3 min-h-[400px]"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-slate-700">
                {col.label}
              </h3>
              <span className="text-xs text-slate-500">
                {col.issues.length}
              </span>
            </div>
            <div className="space-y-2">
              {col.issues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => setSelected(issue)}
                  className="w-full text-left rounded-md bg-white border border-slate-200 p-3 hover:border-slate-400 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={issue.severity} />
                    <span className="text-xs font-mono text-slate-500">
                      {issue.id}
                    </span>
                  </div>
                  <div className="text-sm font-medium line-clamp-2">
                    {issue.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {issue.location.file}
                  </div>
                </button>
              ))}
              {col.issues.length === 0 && (
                <div className="text-xs text-slate-400 italic">empty</div>
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
        />
      )}
    </>
  );
}

function IssuePanel({
  issue,
  onClose,
  onChange,
}: {
  issue: Issue;
  onClose: () => void;
  onChange: (status: IssueStatus) => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/20 flex justify-end z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg h-full overflow-y-auto p-6 border-l border-slate-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs font-mono text-slate-500">{issue.id}</span>
            <h2 className="text-xl font-bold mt-1">{issue.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <SeverityBadge severity={issue.severity} />
          {issue.owasp_category && (
            <span className="text-xs px-1.5 py-0.5 rounded border bg-slate-100 border-slate-200">
              {issue.owasp_category}
            </span>
          )}
          {issue.cwe.map((c) => (
            <span
              key={c}
              className="text-xs px-1.5 py-0.5 rounded border bg-slate-100 border-slate-200"
            >
              {c}
            </span>
          ))}
        </div>

        <dl className="text-sm space-y-1 mb-4">
          <div>
            <dt className="inline text-slate-500">Location:</dt>{" "}
            <dd className="inline font-mono">
              {issue.location.file}:{issue.location.line_range[0]}
            </dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Status:</dt>{" "}
            <dd className="inline">{issue.status}</dd>
          </div>
          {issue.linked_pr && (
            <div>
              <dt className="inline text-slate-500">PR:</dt>{" "}
              <dd className="inline">
                <a
                  href={issue.linked_pr}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {issue.linked_pr}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="mb-4">
          <h3 className="font-semibold text-sm mb-1">Analysis</h3>
          <p className="text-sm text-slate-700">{issue.evidence.analysis}</p>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold text-sm mb-1">Change status</h3>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLUMNS.map((col) => (
              <button
                key={col.status}
                disabled={col.status === issue.status}
                onClick={() => onChange(col.status)}
                className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {col.label}
              </button>
            ))}
          </div>
        </div>

        <Link
          href={`/issue/${issue.id}`}
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          Full detail →
        </Link>
      </div>
    </div>
  );
}
