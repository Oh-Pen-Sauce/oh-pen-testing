"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  PlaybookCatalogEntry,
  PlaybookRiskProfile,
} from "../../../lib/playbooks";
import { saveDisabledPlaybooksAction } from "./actions";
import { SeverityPill } from "../../../components/trattoria/severity-pill";
import type { Severity } from "@oh-pen-testing/shared";

/**
 * Interactive tests catalog. Shows every playbook grouped by
 * category with:
 *   - toggle (enabled by default; disabled = opt-out in config)
 *   - severity pill (what the playbook flags at)
 *   - risk-profile badge (runtime invasiveness — safe / read-only / probe / mutating)
 *   - impact sentence (human explanation)
 *   - CWE / OWASP tags
 *
 * Per the handoff's "foolproof onboarding" note: we make it easy for a
 * first-time user to scan the page and understand what each test could
 * *do* to their app before they decide to leave it enabled.
 */

const RISK_BADGE: Record<
  PlaybookRiskProfile,
  { label: string; bg: string; fg: string; desc: string }
> = {
  safe: {
    label: "safe",
    bg: "#E4F0DF",
    fg: "#2B5A27",
    desc: "Static scan — no network, no side-effects.",
  },
  "read-only": {
    label: "read-only",
    bg: "#DEE4F5",
    fg: "#1E3A8A",
    desc: "Makes GET requests. Cannot mutate state on your target.",
  },
  probe: {
    label: "probe",
    bg: "#FBF4D9",
    fg: "#8C6A05",
    desc: "Sends POST/PUT but safely replayable. No emails, no uploads.",
  },
  mutating: {
    label: "mutating",
    bg: "#FBE4E0",
    fg: "#8F1E10",
    desc: "May cause real-world side-effects (send emails, write files, bump rate-limit counters). Dev/staging only.",
  },
};

export function TestsCatalogClient({
  catalog,
  initiallyDisabled,
}: {
  catalog: PlaybookCatalogEntry[];
  initiallyDisabled: string[];
}) {
  const [disabled, setDisabled] = useState<Set<string>>(
    new Set(initiallyDisabled),
  );
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) =>
      [p.id, p.displayName, p.description, p.category, ...p.cwe]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [catalog, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlaybookCatalogEntry[]>();
    for (const p of filtered) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [filtered]);

  function toggle(id: string) {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
      return next;
    });
  }

  function persist(next: Set<string>) {
    startTransition(async () => {
      await saveDisabledPlaybooksAction(Array.from(next));
      setSavedAt(Date.now());
    });
  }

  const enabledCount = catalog.length - disabled.size;

  return (
    <div>
      {/* Search + summary bar */}
      <div
        className="rounded-xl p-4 mb-5 flex items-center gap-4 flex-wrap"
        style={{
          background: "var(--cream-soft)",
          border: "2px solid var(--ink)",
        }}
      >
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tests by id, description, CWE…"
            className="w-full px-3 py-2.5 text-[13px] rounded-md outline-none"
            style={{
              background: "var(--cream)",
              border: "1.5px solid var(--ink)",
              color: "var(--ink)",
            }}
          />
        </div>
        <div
          className="text-[12px]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="text-ink-soft">enabled </span>
          <strong style={{ color: "var(--basil-dark)" }}>
            {enabledCount}
          </strong>
          <span className="text-ink-soft"> / {catalog.length}</span>
          {pending && (
            <span className="ml-3 text-ink-soft">saving…</span>
          )}
          {savedAt && !pending && (
            <span className="ml-3" style={{ color: "var(--basil)" }}>
              ✓ saved
            </span>
          )}
        </div>
      </div>

      {/* Risk-profile legend */}
      <div
        className="rounded-xl p-4 mb-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4"
        style={{
          background: "var(--parmesan)",
          border: "2px solid var(--ink)",
        }}
      >
        {(Object.keys(RISK_BADGE) as PlaybookRiskProfile[]).map((r) => (
          <div key={r} className="flex items-start gap-2">
            <span
              className="text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-[3px] rounded shrink-0"
              style={{
                background: RISK_BADGE[r].bg,
                color: RISK_BADGE[r].fg,
                border: "1px solid var(--ink)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {RISK_BADGE[r].label}
            </span>
            <span className="text-[11.5px] text-ink-soft leading-snug">
              {RISK_BADGE[r].desc}
            </span>
          </div>
        ))}
      </div>

      {/* Catalog grouped by category */}
      {grouped.map(([category, items]) => (
        <section key={category} className="mb-6">
          <h2
            className="font-black italic text-[22px] text-ink m-0 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {prettyCategory(category)}
            <span
              className="ml-2 text-[11px] font-normal text-ink-soft"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ({items.length})
            </span>
          </h2>
          <div className="flex flex-col gap-2.5">
            {items.map((p) => (
              <TestRow
                key={p.id}
                entry={p}
                disabled={disabled.has(p.id)}
                onToggle={() => toggle(p.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div
          className="rounded-xl py-10 px-6 text-center italic text-ink-soft"
          style={{
            background: "var(--cream-soft)",
            border: "2px dashed var(--ink)",
          }}
        >
          No tests match the search.
        </div>
      )}
    </div>
  );
}

function TestRow({
  entry,
  disabled,
  onToggle,
}: {
  entry: PlaybookCatalogEntry;
  disabled: boolean;
  onToggle: () => void;
}) {
  const risk = RISK_BADGE[entry.risk_profile];
  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 rounded-lg"
      style={{
        background: disabled ? "var(--cream-soft)" : "var(--cream)",
        border: "1.5px solid var(--ink)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-[38px] h-[22px] rounded-full relative shrink-0 mt-0.5"
        style={{
          background: disabled ? "#ccc" : "var(--basil)",
          border: "2px solid var(--ink)",
          cursor: "pointer",
        }}
        aria-pressed={!disabled}
        aria-label={`Toggle ${entry.displayName}`}
      >
        <span
          className="absolute top-[1px] w-[14px] h-[14px] rounded-full transition-all"
          style={{
            left: disabled ? "1px" : "18px",
            background: "var(--cream)",
            border: "1.5px solid var(--ink)",
          }}
          aria-hidden
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-ink">
            {entry.displayName}
          </span>
          <SeverityPill severity={entry.severity_default as Severity} size="sm" />
          <span
            className="text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-[2px] rounded"
            style={{
              background: risk.bg,
              color: risk.fg,
              border: `1px solid var(--ink)`,
              fontFamily: "var(--font-mono)",
            }}
          >
            {risk.label}
          </span>
          {entry.owasp_ref && (
            <code
              className="text-[10px] text-ink-soft"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {entry.owasp_ref}
            </code>
          )}
          {entry.cwe.slice(0, 2).map((c) => (
            <code
              key={c}
              className="text-[10px] text-ink-soft"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {c}
            </code>
          ))}
        </div>
        <div className="text-[12.5px] text-ink-soft mt-1.5 leading-snug">
          {entry.description}
        </div>
        {entry.impact && (
          <div
            className="mt-2 text-[11.5px] px-2.5 py-1.5 rounded leading-snug"
            style={{
              background:
                entry.risk_profile === "mutating" ? "#FBE4E0" : "transparent",
              color:
                entry.risk_profile === "mutating"
                  ? "var(--sauce-dark)"
                  : "var(--ink-soft)",
              border:
                entry.risk_profile === "mutating"
                  ? "1px solid var(--sauce)"
                  : "1px dashed rgba(34,26,20,0.2)",
            }}
          >
            <strong
              className="tracking-[0.1em] uppercase text-[9px] mr-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              impact
            </strong>
            {entry.impact}
          </div>
        )}
        <code
          className="text-[10px] text-ink-soft block mt-1.5"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {entry.id}
        </code>
      </div>
    </div>
  );
}

function prettyCategory(raw: string): string {
  switch (raw) {
    case "owasp-top-10":
      return "OWASP Top 10";
    case "cwe-top-25":
      return "CWE Top 25";
    case "wstg":
      return "OWASP WSTG";
    case "iac":
      return "Infrastructure-as-Code";
    case "sca":
      return "Software Composition Analysis";
    case "secrets":
      return "Secrets";
    case "custom":
      return "Custom";
    default:
      return raw;
  }
}
