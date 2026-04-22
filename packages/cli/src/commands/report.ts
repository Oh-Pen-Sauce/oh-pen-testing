import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  buildCycloneDx,
  buildSarifLog,
  buildSpdx,
  listIssues,
  loadConfig,
  ohpenPaths,
  type Issue,
  type ScanRun,
} from "@oh-pen-testing/shared";
import { buildPdfReport } from "@oh-pen-testing/shared/pdf-report";
import { CLI_VERSION } from "../index.js";

export function registerReport(program: Command): void {
  program
    .command("report")
    .description("Generate a report from the latest scan")
    .option(
      "-f, --format <format>",
      "markdown | json | sarif | pdf | sbom-cyclonedx | sbom-spdx (default: markdown)",
      "markdown",
    )
    .option(
      "-o, --output <path>",
      "Write to a file instead of stdout (relative to cwd)",
    )
    .action(async (opts: { format: string; output?: string }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const paths = ohpenPaths(cwd);
      const issues = await listIssues(cwd);

      if (issues.length === 0) {
        // eslint-disable-next-line no-console
        console.log(
          pc.yellow(
            "No issues found. Run `opt scan` first, then try `opt report` again.",
          ),
        );
        return;
      }

      const latestScan = await readLatestScan(paths.scans);
      const scanForReport =
        latestScan ?? buildFallbackScan(issues[0]!.scan_id ?? "SCAN-000");

      let body: string | Uint8Array;
      let suggestedFile: string;
      let encoding: "utf-8" | "binary" = "utf-8";

      switch (opts.format) {
        case "sarif":
          body = JSON.stringify(
            buildSarifLog({
              issues,
              scan: scanForReport,
              toolVersion: CLI_VERSION,
            }),
            null,
            2,
          );
          suggestedFile = "oh-pen-testing.sarif";
          break;
        case "json":
          body = JSON.stringify({ issues, scan: latestScan }, null, 2);
          suggestedFile = "oh-pen-testing-report.json";
          break;
        case "pdf": {
          const config = await safeLoadConfigOrNull(cwd);
          body = await buildPdfReport({
            issues,
            scan: scanForReport,
            toolVersion: CLI_VERSION,
            projectName: config?.project.name ?? "Unnamed project",
            generatedAt: new Date(),
          });
          suggestedFile = "oh-pen-testing-report.pdf";
          encoding = "binary";
          break;
        }
        case "sbom-cyclonedx": {
          const config = await safeLoadConfigOrNull(cwd);
          body = await buildCycloneDx({
            cwd,
            projectName: config?.project.name ?? "Unnamed project",
            toolVersion: CLI_VERSION,
          });
          suggestedFile = "oh-pen-testing-sbom.cyclonedx.json";
          break;
        }
        case "sbom-spdx": {
          const config = await safeLoadConfigOrNull(cwd);
          body = await buildSpdx({
            cwd,
            projectName: config?.project.name ?? "Unnamed project",
            toolVersion: CLI_VERSION,
          });
          suggestedFile = "oh-pen-testing-sbom.spdx.json";
          break;
        }
        case "markdown":
        default:
          body = buildMarkdownReport(issues, latestScan);
          suggestedFile = "oh-pen-testing-report.md";
          break;
      }

      const outPath = opts.output
        ? path.isAbsolute(opts.output)
          ? opts.output
          : path.join(cwd, opts.output)
        : path.join(paths.reports, suggestedFile);

      await fs.mkdir(path.dirname(outPath), { recursive: true });
      if (encoding === "binary") {
        await fs.writeFile(outPath, Buffer.from(body as Uint8Array));
      } else {
        await fs.writeFile(outPath, body as string, "utf-8");
      }
      // eslint-disable-next-line no-console
      console.log(
        pc.green(`✔ ${opts.format} report written → ${outPath}`),
      );
    });
}

async function safeLoadConfigOrNull(cwd: string) {
  try {
    return await loadConfig(cwd);
  } catch {
    return null;
  }
}

async function readLatestScan(scansDir: string): Promise<ScanRun | null> {
  try {
    const files = await fs.readdir(scansDir);
    const scans: ScanRun[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(scansDir, f), "utf-8");
        scans.push(JSON.parse(raw) as ScanRun);
      } catch {
        /* skip */
      }
    }
    scans.sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
    return scans[0] ?? null;
  } catch {
    return null;
  }
}

function buildFallbackScan(scanId: string): ScanRun {
  return {
    id: scanId,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    triggered_by: "cli",
    playbooks_run: 0,
    playbooks_skipped: 0,
    issues_found: 0,
    issues_remediated: 0,
    ai_calls: 0,
    tokens_spent: 0,
    cost_usd: 0,
    provider: "unknown",
    checkpoint: null,
    status: "completed",
  };
}

function buildMarkdownReport(
  issues: Issue[],
  scan: ScanRun | null,
): string {
  const lines: string[] = [];
  lines.push(`# Oh Pen Testing Report`);
  lines.push("");
  if (scan) {
    lines.push(`- **Scan ID:** ${scan.id}`);
    lines.push(`- **Started:** ${scan.started_at}`);
    lines.push(`- **Ended:** ${scan.ended_at ?? "—"}`);
    lines.push(`- **Provider:** ${scan.provider}`);
    lines.push(`- **Playbooks run:** ${scan.playbooks_run}`);
    lines.push(`- **Issues found:** ${scan.issues_found}`);
  }
  lines.push("");

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const i of issues) bySeverity[i.severity] += 1;
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Severity | Count |`);
  lines.push(`|---|---|`);
  for (const s of ["critical", "high", "medium", "low", "info"] as const) {
    lines.push(`| ${s} | ${bySeverity[s]} |`);
  }
  lines.push("");

  lines.push(`## Issues`);
  lines.push("");
  const sorted = [...issues].sort(
    (a, b) => severityOrder(a.severity) - severityOrder(b.severity),
  );
  for (const i of sorted) {
    lines.push(
      `### ${i.id} · [${i.severity.toUpperCase()}] ${i.title}`,
    );
    lines.push("");
    if (i.owasp_category) lines.push(`- **OWASP:** ${i.owasp_category}`);
    if (i.cwe.length > 0) lines.push(`- **CWE:** ${i.cwe.join(", ")}`);
    lines.push(
      `- **Location:** \`${i.location.file}:${i.location.line_range[0]}\``,
    );
    lines.push(`- **Status:** ${i.status}`);
    if (i.linked_pr) lines.push(`- **PR:** ${i.linked_pr}`);
    if (i.verification.verified_at) {
      lines.push(`- **Verified:** ${i.verification.verified_at}`);
    }
    lines.push("");
    lines.push(`#### Scanner output`);
    lines.push("```");
    lines.push(i.evidence.code_snippet);
    lines.push("```");
    lines.push("");
    lines.push(`#### AI analysis`);
    lines.push(i.evidence.analysis);
    if (i.evidence.ai_reasoning && i.evidence.ai_reasoning !== i.evidence.analysis) {
      lines.push("");
      lines.push(`<details><summary>Detailed reasoning</summary>`);
      lines.push("");
      lines.push(i.evidence.ai_reasoning);
      lines.push("");
      lines.push(`</details>`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push(`_Generated by Oh Pen Testing v${CLI_VERSION}._`);
  return lines.join("\n");
}

function severityOrder(s: Issue["severity"]): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s];
}
