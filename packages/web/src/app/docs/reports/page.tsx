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

const FORMATS = [
  {
    flag: "markdown",
    ext: ".md",
    title: "Markdown",
    tag: "human-readable",
    desc: "A structured narrative report — executive summary, findings by severity, per-issue analysis, and remediation status. Drop it into Notion, Confluence, or a GitHub issue.",
  },
  {
    flag: "json",
    ext: ".json",
    title: "JSON",
    tag: "machine-readable",
    desc: "Full structured output of every scan, issue, agent run, and verification result. Feed it into your own dashboards, compliance pipelines, or CI checks.",
  },
  {
    flag: "sarif",
    ext: ".sarif",
    title: "SARIF 2.1.0",
    tag: "CI integration",
    desc: "The Static Analysis Results Interchange Format. Upload to GitHub Code Scanning, Snyk, Sonatype, or any SARIF-compatible viewer to get inline annotations on your PRs.",
  },
  {
    flag: "pdf",
    ext: ".pdf",
    title: "PDF",
    tag: "consultancy",
    desc: "A polished, print-ready penetration test deliverable. Suitable for handing to clients, legal, or compliance teams. Includes scope, methodology, findings table, and appendices.",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        kicker="La Guida · 05"
        title="Reports"
        sub="Export findings in four formats — from a quick markdown summary to a consultancy-grade PDF."
        actions={
          <BtnLink href="/docs/install" variant="ghost">
            ← Back to Install
          </BtnLink>
        }
      />

      <div
        className="rounded-xl p-5 mb-6"
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
          Basic usage
        </div>
        <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
          Reports are generated from the issues and scan data already in{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>.ohpentesting/</code>.
          Run{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>opt scan</code> first,
          then generate a report in any format:
        </p>
        <Code>{`opt report --format markdown   # default
opt report --format json
opt report --format sarif
opt report --format pdf

# Combine formats in one pass
opt report --format markdown,json,sarif`}</Code>
        <p className="text-[13px] text-ink-soft mt-3">
          Output files are written to{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>
            .ohpentesting/reports/
          </code>{" "}
          with a timestamp in the filename.
        </p>
      </div>

      <div
        className="text-[13px] font-bold tracking-[0.15em] uppercase mb-4"
        style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
      >
        Formats
      </div>

      <div className="grid gap-4 mb-6">
        {FORMATS.map((f) => (
          <div
            key={f.flag}
            className="rounded-xl p-5 flex gap-5"
            style={{
              background: "var(--cream)",
              border: "2px solid var(--ink)",
              boxShadow: "3px 3px 0 var(--ink)",
            }}
          >
            <div className="shrink-0">
              <code
                className="block text-[12px] font-black px-2.5 py-1.5 rounded-lg text-center"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: "#0f0b08",
                  color: "#8bd17c",
                  border: "2px solid var(--ink)",
                  minWidth: 64,
                }}
              >
                {f.ext}
              </code>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[15px] font-black text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {f.title}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "var(--parmesan)",
                    border: "1px solid var(--ink)",
                    color: "var(--sauce-dark)",
                  }}
                >
                  {f.tag}
                </span>
              </div>
              <p className="text-[13.5px] text-ink-soft leading-relaxed m-0">
                {f.desc}
              </p>
              <code
                className="text-[11px] mt-2 block"
                style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
              >
                --format {f.flag}
              </code>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--parmesan)",
          border: "2px solid var(--ink)",
        }}
      >
        <div
          className="text-[11px] font-bold tracking-[0.15em] uppercase mb-3"
          style={{ fontFamily: "var(--font-mono)", color: "var(--sauce-dark)" }}
        >
          GitHub Code Scanning (SARIF)
        </div>
        <p className="text-[14px] text-ink-soft mb-3 leading-relaxed">
          Upload the SARIF report to GitHub to get inline annotations on pull
          requests and a persistent security overview on your repo:
        </p>
        <Code>{`opt report --format sarif

# Upload via the GitHub CLI
gh api \\
  --method POST \\
  -H "Accept: application/vnd.github+json" \\
  /repos/OWNER/REPO/code-scanning/sarifs \\
  -f commit_sha=$(git rev-parse HEAD) \\
  -f ref=$(git symbolic-ref HEAD) \\
  -f sarif=$(cat .ohpentesting/reports/*.sarif | base64)`}</Code>
        <p className="text-[13px] text-ink-soft mt-3">
          Or add an <code style={{ fontFamily: "var(--font-mono)" }}>upload-sarif</code> step to your GitHub
          Actions workflow using the{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>github/codeql-action/upload-sarif</code> action.
        </p>
      </div>

      <div className="flex justify-between mt-6">
        <BtnLink href="/docs/agents" variant="ghost">
          ← Agents
        </BtnLink>
        <BtnLink href="/docs/install" variant="ghost">
          ↑ Back to start
        </BtnLink>
      </div>
    </div>
  );
}
