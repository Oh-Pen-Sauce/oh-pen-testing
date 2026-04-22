"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlaybookCatalogEntry } from "../../lib/playbooks";
import type { Severity } from "@oh-pen-testing/shared";
import { SeverityPill } from "../../components/trattoria/severity-pill";
import { agentById } from "../../components/trattoria/agents";

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
      {/* Filter panel */}
      <div
        className="mb-5 rounded-xl p-4 space-y-3"
        style={{
          background: "var(--cream-soft)",
          border: "2px solid var(--ink)",
        }}
      >
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg"
          style={{
            background: "var(--cream)",
            border: "1.5px solid var(--ink)",
          }}
        >
          <span className="text-sm" aria-hidden>
            🔎
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search playbooks by ID, description, rule, CWE, language…"
            className="flex-1 bg-transparent outline-none text-[13px] text-ink"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="All OWASP"
            active={owasp === null}
            onClick={() => setOwasp(null)}
          />
          {OWASP_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              active={owasp === c}
              onClick={() => setOwasp(c === owasp ? null : c)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="Any severity"
            active={severity === null}
            onClick={() => setSeverity(null)}
          />
          {SEVERITIES.map((s) => (
            <Chip
              key={s}
              label={s}
              active={severity === s}
              onClick={() => setSeverity(s === severity ? null : s)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="Any agent"
            active={agent === null}
            onClick={() => setAgent(null)}
          />
          {agentIds.map((a) => (
            <Chip
              key={a}
              label={a}
              active={agent === a}
              onClick={() => setAgent(a === agent ? null : a)}
            />
          ))}
        </div>
        <div
          className="text-[11px] text-ink-soft italic"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {filtered.length} of {catalog.length} shown
        </div>
      </div>

      {/* Playbook grid */}
      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/playbooks/${encodeURIComponent(p.id)}`}
            className="block rounded-[10px] p-4 transition-transform hover:-translate-y-[2px]"
            style={{
              background: "var(--cream-soft)",
              border: "2px solid var(--ink)",
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div
                className="text-[11px] text-ink-soft break-all"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {p.id}
              </div>
              <SeverityPill
                severity={p.severity_default as Severity}
                size="sm"
              />
            </div>
            <h4
              className="m-0 mb-1.5 font-black text-[19px] text-ink leading-tight"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
            >
              {p.displayName}
            </h4>
            <p className="text-[12.5px] leading-snug text-ink-soft m-0 mb-3 line-clamp-2">
              {p.description}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {p.owasp_ref && <Tag>{p.owasp_ref}</Tag>}
              {p.cwe.slice(0, 2).map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
              <Tag fill color={agentById(p.assignedAgent.id)?.color ?? "var(--sauce)"}>
                {p.assignedAgent.emoji} {p.assignedAgent.id}
              </Tag>
              <Tag>{p.type}</Tag>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <div
          className="rounded-xl py-10 px-6 text-center italic text-ink-soft mt-4"
          style={{
            background: "var(--cream-soft)",
            border: "2px dashed var(--ink)",
          }}
        >
          No playbooks match — try clearing a filter or widening the search.
        </div>
      )}
    </div>
  );
}

function Chip({
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
      className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
      style={{
        background: active ? "var(--sauce)" : "var(--cream)",
        color: active ? "var(--cream)" : "var(--ink)",
        border: "1.5px solid var(--ink)",
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Tag({
  children,
  color,
  fill,
}: {
  children: React.ReactNode;
  color?: string;
  fill?: boolean;
}) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-[3px] rounded"
      style={{
        background: fill && color ? color : "var(--cream)",
        color: fill ? "var(--cream)" : "var(--ink)",
        border: `1px solid ${color ?? "var(--ink)"}`,
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  );
}
