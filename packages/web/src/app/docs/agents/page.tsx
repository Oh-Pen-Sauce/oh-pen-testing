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

const AGENTS = [
  {
    emoji: "🍅",
    name: "Marinara",
    color: "#c8321e",
    specialty: "injection · secrets · input-validation",
    desc: "Handles SQL injection, command injection, XSS, hardcoded secrets, and input-validation failures. First responder for the most exploitable classes.",
  },
  {
    emoji: "🥓",
    name: "Carbonara",
    color: "#8f5c2b",
    specialty: "crypto · secrets · TLS",
    desc: "Fixes weak hashing, insecure randomness, deprecated TLS versions, and cryptographic misconfigurations. Also handles secrets rotation when detected.",
  },
  {
    emoji: "🧀",
    name: "Alfredo",
    color: "#d4a017",
    specialty: "auth · access-control · session",
    desc: "Remediates missing authorisation checks, CORS wildcards, insecure password storage, weak policies, and session management issues.",
  },
  {
    emoji: "🌿",
    name: "Pesto",
    color: "#3f7a3a",
    specialty: "dependencies · supply-chain",
    desc: "Upgrades vulnerable packages, patches SCA findings from npm-audit / pip-audit / bundler-audit, and fixes IaC misconfigurations.",
  },
];

const AUTONOMY = [
  {
    mode: "Careful",
    key: "careful",
    desc: "Every PR needs your explicit opt approve before it&rsquo;s opened. Nothing lands without a human sign-off.",
  },
  {
    mode: "Recommended",
    key: "recommended",
    tag: "default",
    desc: "Auto-opens PRs for low/medium non-critical fixes. Pauses for: auth changes, secrets rotation, schema migrations, diffs over 200 lines.",
  },
  {
    mode: "YOLO",
    key: "yolo",
    desc: "Auto-opens everything except the hard-coded safety triggers (auth system rewrites, credential exposure). For teams with strong CI gates.",
  },
];

export default function AgentsPage() {
  return (
    <div>
      <PageHeader
        kicker="La Guida · 04"
        title="Agents & Remediation"
        sub="Four specialist agents draft pull requests for your issues. You control how much autonomy they have."
        actions={
          <BtnLink href="/docs/reports" variant="primary">
            Next: Reports →
          </BtnLink>
        }
      />

      <div
        className="text-[13px] font-bold tracking-[0.15em] uppercase mb-4"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
      >
        The team
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {AGENTS.map((a) => (
          <div
            key={a.name}
            className="rounded-xl p-4"
            style={{
              background: "var(--cream)",
              border: "2px solid var(--ink)",
              boxShadow: "3px 3px 0 var(--ink)",
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[20px] shrink-0"
                style={{
                  background: a.color,
                  border: "2px solid var(--ink)",
                  boxShadow: "2px 2px 0 var(--ink)",
                }}
                aria-hidden
              >
                {a.emoji}
              </div>
              <div>
                <div
                  className="text-[16px] font-black text-ink leading-none"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {a.name}
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--sauce-dark)",
                  }}
                >
                  {a.specialty}
                </div>
              </div>
            </div>
            <p className="text-[13px] text-ink-soft leading-relaxed m-0">
              {a.desc}
            </p>
          </div>
        ))}
      </div>

      <Card title="Running remediation">
        <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
          The right agent is assigned automatically based on the issue type.
          Run a single issue or hand the whole backlog to the agent pool.
        </p>
        <Code>{`# Fix one issue (agent auto-assigned)
opt remediate --issue ISSUE-003

# Fix everything at medium severity or above
opt remediate --all --severity medium

# Specify an agent explicitly
opt remediate --issue ISSUE-003 --agent alfredo`}</Code>
        <p className="text-[13px] text-ink-soft mt-3">
          Agents run in parallel with a work-stealing queue — critical issues
          are picked up first regardless of discovery order.
        </p>
      </Card>

      <div
        className="text-[13px] font-bold tracking-[0.15em] uppercase mb-4 mt-6"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
      >
        Autonomy modes
      </div>

      <div className="mb-6 rounded-xl overflow-hidden" style={{ border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)" }}>
        {AUTONOMY.map((a, i) => (
          <div
            key={a.key}
            className="px-5 py-4"
            style={{
              background: i % 2 === 0 ? "var(--cream)" : "var(--cream-soft)",
              borderBottom: i < AUTONOMY.length - 1 ? "1px solid var(--ink)" : undefined,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[12px] font-black"
                style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}
              >
                {a.mode}
              </span>
              {a.tag && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--basil)",
                    color: "var(--cream)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {a.tag}
                </span>
              )}
            </div>
            <p
              className="text-[13px] text-ink-soft m-0 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: a.desc }}
            />
          </div>
        ))}
      </div>

      <Card title="Approving gated PRs">
        <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
          When an agent pauses on an issue (autonomy gate or{" "}
          <em>Careful</em> mode), it appears in the{" "}
          <strong>Reviews</strong> queue. Approve from the UI or the terminal:
        </p>
        <Code>{`# Approve a specific issue (unblocks the agent to open the PR)
opt approve --issue ISSUE-007

# Verify a fix landed after the PR was merged
opt verify --issue ISSUE-007`}</Code>
      </Card>

      <Card title="Nonna — the quality gate">
        <p className="text-[14px] text-ink-soft leading-relaxed">
          Before any PR is opened, Nonna (the head-chef review agent) reads the
          diff and checks for regressions, test coverage, and correctness. If
          Nonna flags a problem the PR is held until the agent revises. This
          gate is on by default and can be disabled in{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>
            .ohpentesting/config.yml
          </code>{" "}
          under{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>
            agents.review.enabled
          </code>
          .
        </p>
      </Card>

      <div className="flex justify-between mt-6">
        <BtnLink href="/docs/first-scan" variant="ghost">
          ← First Scan
        </BtnLink>
        <BtnLink href="/docs/reports" variant="primary">
          Next: Reports →
        </BtnLink>
      </div>
    </div>
  );
}
