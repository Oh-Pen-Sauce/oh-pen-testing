import Link from "next/link";
import { listIssues, listScans, safeLoadConfig } from "../lib/repo";
import type { Severity } from "@oh-pen-testing/shared";
import { PageHeader } from "../components/trattoria/page-header";
import { Btn, BtnLink } from "../components/trattoria/button";
import { SEVERITY_STYLE, agentById } from "../components/trattoria/agents";

export const dynamic = "force-dynamic";

const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

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

  const openIssues = issues.filter(
    (i) => i.status !== "done" && i.status !== "wont_fix" && i.status !== "verified",
  );
  const resolvedCount = issues.length - openIssues.length;
  const latestScan = scans[0];

  const suggestion = buildSuggestion(config, scans, openIssues.length);

  // Recent activity — last 4 issues by discovered_at
  const activity = [...issues]
    .sort((a, b) => (b.discovered_at ?? "").localeCompare(a.discovered_at ?? ""))
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        kicker="01 — La Cucina"
        title={
          <>
            Buongiorno, <em>chef</em> 👨‍🍳
          </>
        }
        sub={
          config
            ? `Project: ${config.project.name} · Provider: ${config.ai.primary_provider} · Model: ${config.ai.model}`
            : "No config yet. Let Marinara walk you through setup."
        }
        actions={
          <>
            <BtnLink variant="ghost" href="/scans" icon="🔎">
              Scans
            </BtnLink>
            <BtnLink href="/board" icon="→">
              Open board
            </BtnLink>
          </>
        }
      />

      {/* Suggestion ribbon */}
      {suggestion && (
        <div
          className="mb-7 flex items-center gap-3.5 px-4 py-3.5 rounded-xl"
          style={{
            background: "var(--parmesan)",
            border: "2px solid var(--ink)",
          }}
        >
          <div className="text-[26px]" aria-hidden>
            🍝
          </div>
          <div className="flex-1">
            <div
              className="italic font-bold text-[17px] text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              “{suggestion.text}”
            </div>
            {suggestion.meta && (
              <div className="text-xs text-ink-soft mt-0.5">
                {suggestion.meta}
              </div>
            )}
          </div>
          {suggestion.href && suggestion.cta && (
            <Link
              href={suggestion.href}
              className="text-[13px] font-semibold text-sauce underline underline-offset-2"
            >
              {suggestion.cta} →
            </Link>
          )}
        </div>
      )}

      {/* Severity strip */}
      <div className="grid grid-cols-5 gap-3 mb-7">
        {SEVERITY_ORDER.map((s) => (
          <SeverityTile key={s} severity={s} count={bySeverity[s] ?? 0} />
        ))}
      </div>

      {/* Two-card row */}
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "1.3fr 1fr" }}
      >
        {/* Latest scan */}
        <div
          className="rounded-xl p-6 shadow-sauce"
          style={{
            background: "var(--cream-soft)",
            border: "2px solid var(--ink)",
          }}
        >
          <div className="flex justify-between items-start mb-3.5">
            <div>
              <div className="kicker">Latest scan</div>
              <h3
                className="m-0 mt-1 font-black italic text-[22px] text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {latestScan
                  ? latestScan.id
                  : "Nothing simmering yet"}
              </h3>
            </div>
            {latestScan && <ScanStatusBadge status={latestScan.status} />}
          </div>
          {latestScan ? (
            <div className="grid grid-cols-2 gap-2.5 text-[13px]">
              <Kv k="Started" v={formatRelative(latestScan.started_at)} />
              <Kv k="Provider" v={latestScan.provider} />
              <Kv
                k="Playbooks"
                v={`${latestScan.playbooks_run} run · ${latestScan.playbooks_skipped} skipped`}
              />
              <Kv k="Issues found" v={String(latestScan.issues_found)} />
              <Kv k="AI calls" v={String(latestScan.ai_calls)} />
              <Kv
                k="Est. cost"
                v={`$${(latestScan.cost_usd ?? 0).toFixed(2)}`}
              />
            </div>
          ) : (
            <div className="text-[14px] text-ink-soft italic">
              No scans yet. Run{" "}
              <code
                className="px-1.5 py-0.5 rounded"
                style={{ background: "var(--parmesan)" }}
              >
                opt scan
              </code>{" "}
              from your terminal, or let Marinara do it from Setup.
            </div>
          )}
        </div>

        {/* Open issues */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "var(--ink)",
            color: "var(--cream)",
            border: "2px solid var(--ink)",
          }}
        >
          <div
            className="text-[10px] font-bold tracking-[0.15em] uppercase"
            style={{
              color: "var(--sauce-soft)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Open issues
          </div>
          <div
            className="font-black italic leading-none my-2 text-cream"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: openIssues.length > 99 ? 60 : 72,
            }}
          >
            {openIssues.length}
          </div>
          <div className="text-[13px] opacity-75">
            {resolvedCount} resolved · {issues.length} total
          </div>
          {issues.length > 0 && (
            <div
              className="mt-4 flex gap-[2px] h-2 rounded overflow-hidden"
              aria-label="severity distribution"
            >
              {SEVERITY_ORDER.map((s) => {
                const count = bySeverity[s] ?? 0;
                if (!count) return null;
                return (
                  <div
                    key={s}
                    style={{
                      flex: count,
                      background: SEVERITY_STYLE[s].border,
                    }}
                    title={`${s}: ${count}`}
                  />
                );
              })}
            </div>
          )}
          <div
            className="mt-4 pt-3.5 flex justify-between text-[12px]"
            style={{ borderTop: "1px dashed rgba(244,233,212,0.3)" }}
          >
            <Link href="/board">Open the board</Link>
            <span style={{ color: "var(--sauce-soft)" }}>→</span>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      {activity.length > 0 && (
        <div
          className="mt-6 rounded-xl p-[22px]"
          style={{
            background: "var(--cream-soft)",
            border: "2px solid var(--ink)",
          }}
        >
          <div className="kicker mb-3">Activity — today&rsquo;s specials</div>
          {activity.map((i, idx) => {
            const agent = resolveAgentFromDiscoveredBy(i.discovered_by);
            return (
              <div
                key={i.id}
                className="flex items-center gap-3.5 py-2.5"
                style={{
                  borderBottom:
                    idx < activity.length - 1
                      ? "1px dashed rgba(34,26,20,0.18)"
                      : "none",
                }}
              >
                <span className="text-[18px]" aria-hidden>
                  {agent?.emoji ?? "🍝"}
                </span>
                <div className="flex-1 text-[13px] min-w-0">
                  <strong>{agent?.name ?? "Scanner"}</strong>{" "}
                  <Link
                    href={`/issue/${i.id}`}
                    className="hover:underline"
                    style={{ color: "var(--ink)" }}
                  >
                    {i.title}
                  </Link>{" "}
                  <code
                    className="px-1.5 py-[1px] rounded text-[12px]"
                    style={{ background: "var(--cream)" }}
                  >
                    {truncate(i.location.file, 40)}
                  </code>
                </div>
                <span
                  className="text-[10px] text-ink-soft shrink-0"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {formatRelative(i.discovered_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeverityTile({
  severity,
  count,
}: {
  severity: Severity;
  count: number;
}) {
  const c = SEVERITY_STYLE[severity];
  return (
    <div
      className="rounded-[10px] px-4 py-3.5"
      style={{
        background: c.bg,
        border: "2px solid var(--ink)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: c.border, border: "1.5px solid var(--ink)" }}
          aria-hidden
        />
        <span
          className="text-[10px] font-bold tracking-[0.12em] uppercase"
          style={{
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {severity}
        </span>
      </div>
      <div
        className="font-black italic leading-none text-[36px]"
        style={{ fontFamily: "var(--font-display)", color: c.fg }}
      >
        {count}
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] tracking-[0.1em] uppercase mb-0.5"
        style={{
          color: "var(--ink-soft)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {k}
      </div>
      <div className="font-semibold text-ink">{v}</div>
    </div>
  );
}

function ScanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    running: { bg: "#D1E7D3", fg: "#2B5A27", label: "SIMMERING" },
    completed: { bg: "#EDEAE3", fg: "#525252", label: "DONE" },
    failed: { bg: "#FBE4E0", fg: "#8F1E10", label: "BURNT" },
    checkpointed: { bg: "#FBF4D9", fg: "#8C6A05", label: "PAUSED" },
  };
  const c = map[status] ?? { bg: "#EDEAE3", fg: "#525252", label: status.toUpperCase() };
  return (
    <span
      className="px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{
        background: c.bg,
        color: c.fg,
        border: "1.5px solid var(--ink)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {c.label}
    </span>
  );
}

interface Suggestion {
  text: string;
  cta?: string;
  href?: string;
  meta?: string;
}

function buildSuggestion(
  config: Awaited<ReturnType<typeof safeLoadConfig>>,
  scans: Awaited<ReturnType<typeof listScans>>,
  openCount: number,
): Suggestion | null {
  if (!config) {
    return {
      text: "Say ciao to Marinara — she'll get you cooking in about 4 minutes.",
      cta: "Run setup",
      href: "/setup",
    };
  }
  if (scans.length === 0) {
    return {
      text: "Your kitchen's set up, but you haven't scanned yet. Run `opt scan` from the terminal.",
    };
  }
  if (openCount > 0) {
    const s = openCount === 1 ? "" : "s";
    return {
      text: `You have ${openCount} open issue${s} to review.`,
      meta: `Last scan ${formatRelative(scans[0]!.started_at)}`,
      cta: "Review now",
      href: "/board",
    };
  }
  return {
    text: "Zero open issues. Chef's kiss.",
    meta: "Everything's been tasted and approved.",
  };
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const s = Math.round(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.round(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function resolveAgentFromDiscoveredBy(discoveredBy?: string) {
  if (!discoveredBy) return undefined;
  // discovered_by looks like "playbook:<id>/<rule>"; try to match playbook
  // family to a pasta agent.
  const id = discoveredBy.replace(/^playbook:/, "").split("/")[0] ?? "";
  if (/(secret|inject|upload|redirect)/i.test(id)) return agentById("marinara");
  if (/(crypto|tls|jwt|cookie)/i.test(id)) return agentById("carbonara");
  if (/(auth|access|session|broken)/i.test(id)) return agentById("alfredo");
  if (/(sca|deps|cve|depend)/i.test(id)) return agentById("pesto");
  return agentById("marinara");
}
