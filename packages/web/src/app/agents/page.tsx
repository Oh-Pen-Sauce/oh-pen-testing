import Link from "next/link";
import {
  AGENT_IDS,
  loadAllAgentProfiles,
  type AgentProfile,
} from "@oh-pen-testing/shared";
import { resolveScanTargetPath } from "../../lib/ohpen-cwd";
import { PageHeader } from "../../components/trattoria/page-header";
import { AGENTS } from "../../components/trattoria/agents";

export const dynamic = "force-dynamic";

export default async function AgentsIndexPage() {
  const cwd = await resolveScanTargetPath();
  const profiles = await loadAllAgentProfiles(cwd);
  const byId = new Map<string, AgentProfile>(
    profiles.map((p) => [p.id, p]),
  );

  return (
    <div>
      <PageHeader
        kicker="09 — La Squadra"
        title={<>Agent roster</>}
        sub={
          <>
            Click an agent to inspect their memory, assigned playbooks, and
            custom skills — and customise any of them for this project.
            Overrides land under{" "}
            <code
              className="px-1 rounded"
              style={{ background: "var(--parmesan)" }}
            >
              .ohpentesting/agents/
            </code>
            ; revert any time to fall back to the bundled defaults.
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {AGENT_IDS.map((id) => {
          const meta = AGENTS.find((a) => a.id === id);
          const profile = byId.get(id);
          if (!meta) return null;
          const overrides =
            (profile?.memorySource === "project" ? 1 : 0) +
            (profile?.playbooksSource === "project" ? 1 : 0) +
            (profile?.customSkills.length ?? 0);
          return (
            <Link
              key={id}
              href={`/agents/${id}`}
              className="rounded-xl p-5 transition-transform hover:-translate-y-px block"
              style={{
                background: "var(--cream-soft)",
                border: "2.5px solid var(--ink)",
                boxShadow: "4px 4px 0 var(--ink)",
                textDecoration: "none",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-[24px] shrink-0"
                  style={{
                    background: meta.color,
                    border: "2px solid var(--ink)",
                  }}
                  aria-hidden
                >
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-black italic text-[22px] text-ink"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {meta.name}
                  </div>
                  <div
                    className="text-[11px] text-ink-soft mt-0.5"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {meta.tag}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    <Tag>
                      {profile?.playbooks.length ?? 0} playbook
                      {profile?.playbooks.length === 1 ? "" : "s"}
                    </Tag>
                    <Tag>
                      {profile?.customSkills.length ?? 0} custom skill
                      {profile?.customSkills.length === 1 ? "" : "s"}
                    </Tag>
                    {overrides > 0 && (
                      <Tag highlight>
                        {overrides} project override
                        {overrides === 1 ? "" : "s"}
                      </Tag>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Tag({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <span
      className="font-bold px-2 py-[2px] rounded"
      style={{
        background: highlight ? "var(--sauce)" : "var(--cream)",
        color: highlight ? "var(--cream)" : "var(--ink)",
        border: "1.5px solid var(--ink)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </span>
  );
}
