import Link from "next/link";
import { listCatalog, allAgents } from "../../lib/playbooks";
import { PlaybookCatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function PlaybooksPage() {
  const [catalog, agents] = await Promise.all([listCatalog(), allAgents()]);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Playbook catalog</h1>
          <p className="text-slate-600">
            Every security test Oh Pen Testing runs, with the exact regex
            rules, AI prompts, and which pasta agent gets the fix.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {catalog.length} playbook{catalog.length === 1 ? "" : "s"}
        </div>
      </div>

      <section className="mb-8">
        <h2 className="font-semibold mb-2 text-sm uppercase tracking-wide text-slate-500">
          Agent roster
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {agents.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="text-2xl">{a.emoji}</div>
              <div className="font-semibold text-sm mt-1">{a.displayName}</div>
              <div className="text-xs text-slate-500">
                {a.specialties.join(", ")}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PlaybookCatalogClient catalog={catalog} />
    </div>
  );
}
