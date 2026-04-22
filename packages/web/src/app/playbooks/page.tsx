import { listCatalog, allAgents } from "../../lib/playbooks";
import { PlaybookCatalogClient } from "./catalog-client";
import { PageHeader } from "../../components/trattoria/page-header";
import { agentById } from "../../components/trattoria/agents";

export const dynamic = "force-dynamic";

export default async function PlaybooksPage() {
  const [catalog, agents] = await Promise.all([listCatalog(), allAgents()]);
  const count = catalog.length;
  return (
    <div>
      <PageHeader
        kicker="04 — Il Ricettario"
        title={<>Playbook catalog</>}
        sub={`${count} playbook${
          count === 1 ? "" : "s"
        }. Every security test Oh Pen Testing runs — with the exact regex rules, AI prompts, and which pasta agent gets the fix.`}
        actions={
          <span
            className="text-[12px] self-end text-ink-soft"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {count} playbook{count === 1 ? "" : "s"}
          </span>
        }
      />

      {/* Agent roster strip */}
      <div className="mb-6">
        <div className="kicker mb-2.5">Agent roster</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {agents.map((a) => {
            const color = agentById(a.id)?.color ?? "var(--sauce)";
            return (
            <div
              key={a.id}
              className="rounded-[10px] px-4 py-3.5 flex gap-2.5 items-start"
              style={{
                background: "var(--cream-soft)",
                border: "2px solid var(--ink)",
                boxShadow: `3px 3px 0 ${color}`,
              }}
            >
              <div
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[22px] shrink-0"
                style={{
                  background: color,
                  border: "2px solid var(--ink)",
                }}
                aria-hidden
              >
                {a.emoji}
              </div>
              <div className="min-w-0">
                <div
                  className="font-black italic text-[18px] leading-none text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {a.displayName}
                </div>
                <div className="text-[11px] text-ink-soft mt-1 leading-snug">
                  {a.specialties.join(" · ")}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <PlaybookCatalogClient catalog={catalog} />
    </div>
  );
}
