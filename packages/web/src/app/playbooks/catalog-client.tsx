"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlaybookCatalogEntry } from "../../lib/playbooks";

const OWASP_CATEGORIES = [
  "A01",
  "A02",
  "A03",
  "A04",
  "A05",
  "A06",
  "A07",
  "A08",
  "A09",
  "A10",
];

const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

export function PlaybookCatalogClient({
  catalog,
}: {
  catalog: PlaybookCatalogEntry[];
}) {
  const [query, setQuery] = useState("");
  const [owasp, setOwasp] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [agent, setAgent] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((p) => {
      if (owasp && !(p.owasp_ref ?? "").startsWith(owasp)) return false;
      if (severity && p.severity_default !== severity) return false;
      if (agent && p.assignedAgent.id !== agent) return false;
      if (q) {
        const haystack = [
          p.id,
          p.displayName,
          p.description,
          p.category,
          p.owasp_ref ?? "",
          ...p.cwe,
          ...p.languages,
          ...p.rules.map((r) => r.id + " " + r.description),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [catalog, query, owasp, severity, agent]);

  const agentIds = useMemo(() => {
    const ids = new Set(catalog.map((p) => p.assignedAgent.id));
    return Array.from(ids).sort();
  }, [catalog]);

  return (
    <div>
      <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search playbooks by ID, description, rule, CWE, language…"
          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <FilterButton
            label="All OWASP"
            active={owasp === null}
            onClick={() => setOwasp(null)}
          />
          {OWASP_CATEGORIES.map((c) => (
            <FilterButton
              key={c}
              label={c}
              active={owasp === c}
              onClick={() => setOwasp(c === owasp ? null : c)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton
            label="Any severity"
            active={severity === null}
            onClick={() => setSeverity(null)}
          />
          {SEVERITIES.map((s) => (
            <FilterButton
              key={s}
              label={s}
              active={severity === s}
              onClick={() => setSeverity(s === severity ? null : s)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton
            label="Any agent"
            active={agent === null}
            onClick={() => setAgent(null)}
          />
          {agentIds.map((a) => (
            <FilterButton
              key={a}
              label={a}
              active={agent === a}
              onClick={() => setAgent(a === agent ? null : a)}
            />
          ))}
        </div>
        <div className="text-xs text-slate-500">
          {filtered.length} of {catalog.length} shown
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/playbooks/${encodeURIComponent(p.id)}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-sm font-mono text-slate-500 break-all">
                {p.id}
              </div>
              <SeverityPill severity={p.severity_default} />
            </div>
            <div className="font-semibold mb-1">{p.displayName}</div>
            <div className="text-xs text-slate-600 mb-3 line-clamp-2">
              {p.description}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {p.owasp_ref && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {p.owasp_ref}
                </span>
              )}
              {p.cwe.slice(0, 2).map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700"
                >
                  {c}
                </span>
              ))}
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                {p.assignedAgent.emoji} {p.assignedAgent.displayName}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {p.type}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
        active
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-white border-slate-300 text-slate-700 hover:border-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
    info: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`shrink-0 text-xs px-1.5 py-0.5 rounded border ${map[severity] ?? map.info}`}
    >
      {severity}
    </span>
  );
}
