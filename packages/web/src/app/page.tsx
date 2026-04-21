import Link from "next/link";
import { listIssues, listScans, safeLoadConfig } from "../lib/repo";
import type { Severity } from "@oh-pen-testing/shared";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [config, issues, scans] = await Promise.all([
    safeLoadConfig(),
    listIssues(),
    listScans(),
  ]);

  const bySeverity = issues.reduce<Record<Severity, number>>(
    (acc, i) => {
      acc[i.severity] = (acc[i.severity] ?? 0) + 1;
      return acc;
    },
    { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
  );

  const openIssues = issues.filter((i) => i.status !== "done" && i.status !== "wont_fix");
  const latestScan = scans[0];

  const suggestion = buildSuggestion(config, scans, openIssues.length);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-slate-600 mb-8">
        {config
          ? `Project: ${config.project.name} · Provider: ${config.ai.primary_provider}`
          : "No config yet."}
      </p>

      {suggestion && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Suggested next action:</strong> {suggestion.text}{" "}
          {suggestion.href && (
            <Link className="underline ml-1" href={suggestion.href}>
              {suggestion.cta}
            </Link>
          )}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(["critical", "high", "medium", "low", "info"] as const).map((s) => (
          <SeverityCard key={s} severity={s} count={bySeverity[s] ?? 0} />
        ))}
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold mb-2">Latest scan</h2>
          {latestScan ? (
            <dl className="text-sm space-y-1">
              <div>
                <dt className="inline text-slate-500">ID:</dt>{" "}
                <dd className="inline font-mono">{latestScan.id}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Started:</dt>{" "}
                <dd className="inline">{latestScan.started_at}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Status:</dt>{" "}
                <dd className="inline">{latestScan.status}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Issues:</dt>{" "}
                <dd className="inline">{latestScan.issues_found}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">AI calls:</dt>{" "}
                <dd className="inline">{latestScan.ai_calls}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No scans yet.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold mb-2">Open issues</h2>
          <p className="text-3xl font-bold">{openIssues.length}</p>
          <p className="text-sm text-slate-500 mt-2">
            {issues.length - openIssues.length} resolved /{" "}
            {issues.length} total
          </p>
          <Link
            href="/board"
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            Open board →
          </Link>
        </div>
      </section>
    </div>
  );
}

function SeverityCard({ severity, count }: { severity: Severity; count: number }) {
  const colour: Record<Severity, string> = {
    critical: "bg-red-50 border-red-200 text-red-900",
    high: "bg-orange-50 border-orange-200 text-orange-900",
    medium: "bg-yellow-50 border-yellow-200 text-yellow-900",
    low: "bg-blue-50 border-blue-200 text-blue-900",
    info: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-lg border p-3 ${colour[severity]}`}>
      <div className="text-xs uppercase tracking-wide">{severity}</div>
      <div className="text-2xl font-bold">{count}</div>
    </div>
  );
}

interface Suggestion {
  text: string;
  cta?: string;
  href?: string;
}

function buildSuggestion(
  config: Awaited<ReturnType<typeof safeLoadConfig>>,
  scans: Awaited<ReturnType<typeof listScans>>,
  openCount: number,
): Suggestion | null {
  if (!config) {
    return {
      text: "Scaffold your config to get started.",
      cta: "Run setup wizard",
      href: "/setup",
    };
  }
  if (scans.length === 0) {
    return {
      text: "You haven't run a scan yet. From the terminal: `oh-pen-testing scan`.",
    };
  }
  if (openCount > 0) {
    return {
      text: `You have ${openCount} open issue${openCount === 1 ? "" : "s"}.`,
      cta: "Open board →",
      href: "/board",
    };
  }
  return null;
}
