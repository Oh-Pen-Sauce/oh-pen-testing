import { PageHeader } from "@/components/trattoria/page-header";
import { BtnLink } from "@/components/trattoria/button";

function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "#0f0b08",
        border: "2px solid var(--ink)",
        borderRadius: 10,
        padding: "12px 16px",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        color: "#e6d9bf",
        overflowX: "auto",
        margin: "8px 0 0",
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 mb-4"
      style={{
        background: "var(--cream)",
        border: "2px solid var(--ink)",
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      <div
        className="text-[11px] font-bold tracking-[0.15em] uppercase mb-3"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const SEVERITIES = [
  { level: "Critical", color: "var(--sev-critical-fg)", bg: "var(--sev-critical-bg)", desc: "Exploitable now — RCE, auth bypass, credential exposure." },
  { level: "High", color: "var(--sev-high-fg)", bg: "var(--sev-high-bg)", desc: "Significant risk, likely exploitable with moderate effort." },
  { level: "Medium", color: "var(--sev-medium-fg)", bg: "var(--sev-medium-bg)", desc: "Real weakness but requires specific conditions to exploit." },
  { level: "Low", color: "var(--sev-low-fg)", bg: "var(--sev-low-bg)", desc: "Defence-in-depth issues or informational findings." },
];

const PLAYBOOKS = [
  { id: "owasp-top-10", count: 22, desc: "Full OWASP Top 10 — injection, crypto, auth, SSRF, and more" },
  { id: "secrets", count: 1, desc: "Hardcoded API keys, tokens, and credentials" },
  { id: "sca", count: 1, desc: "Dependency audit (npm, pip, bundler)" },
  { id: "wstg-core", count: 3, desc: "OWASP WSTG checks — JWT, clickjacking, CORS" },
  { id: "cwe-top-25", count: 3, desc: "CWE Top 25 — path traversal, open redirect, unrestricted upload" },
  { id: "iac", count: 5, desc: "Infrastructure as code — Dockerfile, Terraform, Kubernetes, Compose" },
];

export default function FirstScanPage() {
  return (
    <div>
      <PageHeader
        kicker="La Guida · 03"
        title="First Scan"
        sub="Run a scan, read the results on the Board, understand severity levels."
        actions={
          <BtnLink href="/docs/agents" variant="primary">
            Next: Agents →
          </BtnLink>
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card title="Starter scan — try this first">
          <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
            Five safe regex-only playbooks. No network calls, no AI cost, completes
            in seconds. A good smoke-test before committing to a full scan.
          </p>
          <Code>opt scan --starter</Code>
        </Card>
        <Card title="Full scan">
          <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
            Runs every enabled playbook catalogue — OWASP Top 10, secrets, SCA,
            WSTG, CWE Top 25, and IaC. Uses your connected AI for context and
            confirmation.
          </p>
          <Code>opt scan</Code>
        </Card>
      </div>

      <Card title="Target specific playbooks">
        <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
          Use <code style={{ fontFamily: "var(--font-mono)" }}>--only</code> to
          run a subset, or override the provider for a single run.
        </p>
        <Code>{`opt scan --only sql-injection-raw,xss-innerHTML
opt scan --provider claude-api --only secrets`}</Code>
      </Card>

      <div
        className="text-[13px] font-bold tracking-[0.15em] uppercase mb-4 mt-6"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
      >
        Playbook catalogue
      </div>

      <div className="mb-6 rounded-xl overflow-hidden" style={{ border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)" }}>
        {PLAYBOOKS.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center gap-4 px-5 py-3"
            style={{
              background: i % 2 === 0 ? "var(--cream)" : "var(--cream-soft)",
              borderBottom: i < PLAYBOOKS.length - 1 ? "1px solid var(--ink)" : undefined,
            }}
          >
            <code
              className="text-[12px] font-bold shrink-0"
              style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)", minWidth: 120 }}
            >
              {p.id}
            </code>
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded shrink-0"
              style={{ background: "var(--parmesan)", border: "1px solid var(--ink)", color: "var(--ink)" }}
            >
              {p.count} playbook{p.count !== 1 ? "s" : ""}
            </span>
            <span className="text-[13px] text-ink-soft">{p.desc}</span>
          </div>
        ))}
      </div>

      <div
        className="text-[13px] font-bold tracking-[0.15em] uppercase mb-4"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
      >
        Severity levels
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {SEVERITIES.map((s) => (
          <div
            key={s.level}
            className="rounded-lg px-4 py-3 flex items-start gap-3"
            style={{ background: s.bg, border: `2px solid var(--ink)` }}
          >
            <span
              className="text-[11px] font-black tracking-[0.1em] uppercase px-2 py-0.5 rounded mt-0.5 shrink-0"
              style={{ background: s.color, color: "#fff", fontFamily: "var(--font-mono)" }}
            >
              {s.level}
            </span>
            <span className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
              {s.desc}
            </span>
          </div>
        ))}
      </div>

      <Card title="Reading results">
        <p className="text-[14px] text-ink-soft leading-relaxed">
          After a scan completes, issues appear on the{" "}
          <strong>Board</strong> (the kanban view) grouped by status:{" "}
          <em>Backlog</em> → <em>Ready</em> → <em>In Review</em> → <em>Done</em>.
          Each issue card shows the severity badge, affected file and line, the
          playbook that flagged it, and a link to the AI&rsquo;s analysis. Click
          any card to open the full issue detail with code context, explanation,
          and remediation options.
        </p>
      </Card>

      <div className="flex justify-between mt-6">
        <BtnLink href="/docs/setup" variant="ghost">
          ← Setup
        </BtnLink>
        <BtnLink href="/docs/agents" variant="primary">
          Next: Agents →
        </BtnLink>
      </div>
    </div>
  );
}
