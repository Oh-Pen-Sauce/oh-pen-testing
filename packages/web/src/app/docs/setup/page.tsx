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

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 mb-5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-black shrink-0 mt-0.5"
        style={{
          background: "var(--sauce)",
          color: "var(--cream)",
          border: "2px solid var(--ink)",
          boxShadow: "2px 2px 0 var(--ink)",
        }}
      >
        {n}
      </div>
      <div className="flex-1">
        <div
          className="text-[15px] font-bold text-ink mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </div>
        <div className="text-[14px] text-ink-soft leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3 mb-6 text-[13.5px] leading-relaxed"
      style={{
        background: "var(--parmesan)",
        border: "2px solid var(--ink)",
        color: "var(--ink-soft)",
      }}
    >
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 mb-5"
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

export default function SetupPage() {
  return (
    <div>
      <PageHeader
        kicker="La Guida · 02"
        title="Setup"
        sub="One command opens the guided wizard. Marinara walks you through everything in under five minutes."
        actions={
          <BtnLink href="/docs/first-scan" variant="primary">
            Next: First Scan →
          </BtnLink>
        }
      />

      <Note>
        <strong>cd into the project you want to scan first.</strong> The scan
        target is the directory you launch{" "}
        <code style={{ fontFamily: "var(--font-mono)" }}>opt</code> from — not
        something it clones remotely.
      </Note>

      <Card title="The one command">
        <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
          Run this from your project root. It scaffolds{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>.ohpentesting/</code>,
          starts the Next.js web wizard on port 7676, and opens your browser automatically.
        </p>
        <Code>opt setup</Code>
        <p className="text-[13px] text-ink-soft mt-3">
          Pass <code style={{ fontFamily: "var(--font-mono)" }}>--port 7777</code> to
          use a different port if 7676 is taken.
        </p>
      </Card>

      <div
        className="text-[13px] font-bold tracking-[0.15em] uppercase mb-4 mt-6"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
      >
        What the wizard does
      </div>

      <div className="mb-8">
        <Step n={1} title="Connect an AI provider">
          The wizard detects whether you have the{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>claude</code> CLI on
          PATH and pre-selects it. Click <strong>▶ Run</strong> to confirm, or
          expand <em>Or pick a different provider</em> to choose Claude API,
          Ollama, or OpenRouter. API-key providers prompt you to paste your key
          — it&rsquo;s stored in your OS keychain, never in the repo.
        </Step>

        <Step n={2} title="Wire GitHub">
          Paste your repo slug (<code style={{ fontFamily: "var(--font-mono)" }}>owner/name</code>) so
          remediation agents know where to open pull requests. Then paste a
          GitHub Personal Access Token with{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>Contents</code> +{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>Pull requests</code>{" "}
          read/write scope. The token is stored in your keychain alongside the
          API key.
        </Step>

        <Step n={3} title="Choose autonomy mode">
          <div>
            Three levels — pick the one that fits your workflow:
            <ul className="mt-2 space-y-1.5 list-none p-0">
              {[
                {
                  mode: "Careful",
                  desc: "Every fix needs your explicit approval before a PR is opened.",
                },
                {
                  mode: "Recommended",
                  desc: "Auto-PR for small, non-critical fixes. Asks first for auth changes, secrets rotation, schema migrations, and large diffs.",
                },
                {
                  mode: "YOLO",
                  desc: "Auto-PR for everything except the hard-coded safety triggers.",
                },
              ].map((m) => (
                <li key={m.mode} className="flex gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-bold shrink-0"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: "var(--parmesan)",
                      border: "1px solid var(--ink)",
                      color: "var(--sauce-dark)",
                    }}
                  >
                    {m.mode}
                  </span>
                  <span className="text-[13px] text-ink-soft">{m.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </Step>

        <Step n={4} title="Acknowledge authorisation">
          A hard gate — you must confirm in writing that you have authorisation
          to test the target codebase. Your name and timestamp are recorded in{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>
            .ohpentesting/config.yml
          </code>
          . No scan can run until this is acknowledged.
        </Step>

        <Step n={5} title="Run your first scan">
          Once setup completes, Marinara offers to kick off a starter scan (5
          safe regex-only playbooks, no network, no AI cost). Accept to see
          results immediately, or skip and run{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>opt scan</code> from
          the terminal whenever you&rsquo;re ready.
        </Step>
      </div>

      <Card title="Terminal-only alternative">
        <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
          If you prefer the terminal over the browser,{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>opt connect</code>{" "}
          handles provider setup interactively and writes the result to{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>config.yml</code>.
          Then run{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>opt scan</code>{" "}
          directly.
        </p>
        <Code>{`opt connect   # interactive provider picker + probe + keychain storage
opt scan      # jump straight to scanning`}</Code>
      </Card>

      <Card title="What gets created">
        <Code>{`.ohpentesting/
  config.yml          ← all your settings live here
  issues/             ← one JSON file per discovered issue
  scans/              ← scan run metadata
  reports/            ← generated reports
  logs/               ← agent activity logs
  playbooks/local/    ← drop custom playbooks here`}</Code>
        <p className="text-[13px] text-ink-soft mt-3">
          The directory is added to your{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>.gitignore</code>{" "}
          automatically — state files never end up in the repo.
        </p>
      </Card>

      <div className="flex justify-between mt-6">
        <BtnLink href="/docs/install" variant="ghost">
          ← Install
        </BtnLink>
        <BtnLink href="/docs/first-scan" variant="primary">
          Next: First Scan →
        </BtnLink>
      </div>
    </div>
  );
}
