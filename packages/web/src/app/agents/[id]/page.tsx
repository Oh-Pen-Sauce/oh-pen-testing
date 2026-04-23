import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AGENT_IDS,
  loadAgentProfile,
  type AgentId,
} from "@oh-pen-testing/shared";
import { resolveScanTargetPath } from "../../../lib/ohpen-cwd";
import { AGENTS } from "../../../components/trattoria/agents";
import { PageHeader } from "../../../components/trattoria/page-header";
import { AgentDetailClient } from "./agent-detail-client";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(AGENT_IDS as string[]).includes(id)) notFound();
  const agentId = id as AgentId;
  const meta = AGENTS.find((a) => a.id === agentId);
  if (!meta) notFound();

  const cwd = await resolveScanTargetPath();
  const profile = await loadAgentProfile(cwd, agentId);

  return (
    <div>
      <PageHeader
        kicker={`09 — La Squadra · ${meta.name.toLowerCase()}`}
        title={
          <>
            <span
              className="inline-flex items-center justify-center rounded-full mr-3 align-middle"
              style={{
                width: 48,
                height: 48,
                background: meta.color,
                border: "2.5px solid var(--ink)",
                fontSize: 26,
              }}
              aria-hidden
            >
              {meta.emoji}
            </span>
            {meta.name}
          </>
        }
        sub={
          <>
            {meta.tag}.{" "}
            <Link
              href="/agents"
              className="underline"
              style={{ color: "var(--sauce)" }}
            >
              Back to roster →
            </Link>
          </>
        }
      />
      <AgentDetailClient profile={profile} meta={meta} />
    </div>
  );
}
