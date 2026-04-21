import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogEntry } from "../../../lib/playbooks";

export const dynamic = "force-dynamic";

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const playbook = await getCatalogEntry(decoded);
  if (!playbook) notFound();

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/playbooks"
          className="text-sm text-slate-500 hover:underline"
        >
          ← All playbooks
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-mono text-slate-500 break-all">
            {playbook.id}
          </div>
          <h1 className="text-3xl font-bold mt-1">{playbook.displayName}</h1>
        </div>
        <SeverityPill severity={playbook.severity_default} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {playbook.owasp_ref && <Chip text={playbook.owasp_ref} />}
        {playbook.cwe.map((c) => (
          <Chip key={c} text={c} />
        ))}
        <Chip text={`Type: ${playbook.type}`} />
        <Chip
          text={playbook.risky ? "Risky (opt-in)" : "Safe"}
          accent={playbook.risky ? "amber" : "green"}
        />
        {playbook.languages.map((l) => (
          <Chip key={l} text={l} accent="slate" />
        ))}
      </div>

      <p className="text-slate-700 mb-8">{playbook.description}</p>

      <section className="mb-8 rounded-lg border border-blue-200 bg-blue-50/30 p-5">
        <h2 className="font-semibold text-sm mb-2">
          Assigned agent when a hit becomes an issue
        </h2>
        <div className="flex items-start gap-4">
          <div className="text-4xl">{playbook.assignedAgent.emoji}</div>
          <div className="flex-1">
            <div className="font-semibold">
              {playbook.assignedAgent.displayName}
            </div>
            <div className="text-sm text-slate-600 mb-2">
              Specialties: {playbook.assignedAgent.specialties.join(", ")}
            </div>
            <details>
              <summary className="text-sm text-blue-700 cursor-pointer">
                System prompt suffix (what primes the agent for this fix)
              </summary>
              <pre className="mt-2 text-xs bg-white border border-slate-200 rounded p-3 whitespace-pre-wrap">
                {playbook.assignedAgent.systemPromptSuffix}
              </pre>
            </details>
          </div>
        </div>
      </section>

      {playbook.rules.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold mb-3">
            Regex rules ({playbook.rules.length})
          </h2>
          <div className="space-y-3">
            {playbook.rules.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-mono text-sm">{r.id}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {r.description}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-1.5 py-0.5 rounded border ${
                      r.require_ai_confirm
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {r.require_ai_confirm ? "AI-confirmed" : "regex-only"}
                  </span>
                </div>
                {r.pattern && (
                  <pre className="text-xs bg-slate-900 text-slate-100 rounded p-3 overflow-x-auto font-mono">
                    {r.pattern}
                    {r.flags ? `\nflags: ${r.flags}` : ""}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {playbook.scanPrompt && (
        <section className="mb-8">
          <h2 className="font-semibold mb-2">AI scan prompt</h2>
          <div className="text-xs text-slate-500 mb-1">
            Prepended to the AI's system prompt when confirming candidate hits
            from this playbook.
          </div>
          <pre className="text-xs bg-slate-900 text-slate-100 rounded p-4 overflow-x-auto whitespace-pre-wrap font-mono">
            {playbook.scanPrompt}
          </pre>
        </section>
      )}

      {playbook.remediatePrompt && (
        <section className="mb-8">
          <h2 className="font-semibold mb-2">AI remediation prompt</h2>
          <div className="text-xs text-slate-500 mb-1">
            Prepended to the agent's system prompt when it's time to fix an
            issue discovered by this playbook.
          </div>
          <pre className="text-xs bg-slate-900 text-slate-100 rounded p-4 overflow-x-auto whitespace-pre-wrap font-mono">
            {playbook.remediatePrompt}
          </pre>
        </section>
      )}

      <section className="text-xs text-slate-500 border-t border-slate-200 pt-4">
        Edit or contribute at{" "}
        <a
          href={`https://github.com/Oh-Pen-Sauce/oh-pen-testing/tree/main/playbooks/core/${playbook.id}`}
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          playbooks/core/{playbook.id}
        </a>
        .
      </section>
    </div>
  );
}

function Chip({
  text,
  accent = "neutral",
}: {
  text: string;
  accent?: "neutral" | "slate" | "amber" | "green";
}) {
  const map = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
    amber: "bg-amber-100 text-amber-900 border-amber-200",
    green: "bg-green-100 text-green-800 border-green-200",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded border ${map[accent]}`}>
      {text}
    </span>
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
      className={`shrink-0 text-sm px-2 py-1 rounded border ${map[severity] ?? map.info}`}
    >
      {severity}
    </span>
  );
}
