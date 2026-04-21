import type { Issue } from "../models/issue.js";
import {
  FRAMEWORKS,
  type FrameworkId,
  type ComplianceFramework,
} from "./frameworks.js";

export interface ControlStatus {
  controlId: string;
  title: string;
  summary: string;
  status: "no-findings" | "findings-open" | "findings-resolved";
  evidenceCount: number;
  openIssues: string[];
  resolvedIssues: string[];
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  controls: ControlStatus[];
  summary: {
    total: number;
    clean: number;
    withOpenFindings: number;
    withResolvedFindings: number;
  };
}

function issueMatchesControl(
  issue: Issue,
  control: ComplianceFramework["controls"][number],
): boolean {
  if (control.playbookIds) {
    // discovered_by looks like "playbook:<id-with-slashes>/<rule>" — the
    // playbook id itself contains slashes (e.g. owasp-top-10/a01-...), so
    // strip exactly one trailing segment for the rule id.
    let pb: string | undefined;
    if (issue.discovered_by?.startsWith("playbook:")) {
      const body = issue.discovered_by.slice("playbook:".length);
      const lastSlash = body.lastIndexOf("/");
      pb = lastSlash > 0 ? body.slice(0, lastSlash) : body;
    }
    if (pb && control.playbookIds.includes(pb)) return true;
  }
  if (control.cwes && issue.cwe.length > 0) {
    for (const cwe of issue.cwe) {
      if (control.cwes.includes(cwe)) return true;
    }
  }
  if (control.owaspRefs && issue.owasp_category) {
    if (control.owaspRefs.includes(issue.owasp_category)) return true;
  }
  return false;
}

/**
 * Map a list of issues onto a compliance framework.
 *
 * A control is:
 *   - no-findings if zero issues match it
 *   - findings-open if at least one matching issue is still in backlog/ready
 *   - findings-resolved if matching issues exist and all are verified/closed
 */
export function buildComplianceReport(
  frameworkId: FrameworkId,
  issues: Issue[],
): ComplianceReport {
  const framework = FRAMEWORKS[frameworkId];
  if (!framework) {
    throw new Error(`Unknown framework: ${frameworkId}`);
  }

  const controls: ControlStatus[] = framework.controls.map((control) => {
    const matches = issues.filter((i) => issueMatchesControl(i, control));
    const open = matches.filter(
      (i) =>
        i.status === "backlog" ||
        i.status === "ready" ||
        i.status === "in_progress" ||
        i.status === "pending_approval" ||
        i.status === "in_review",
    );
    const resolved = matches.filter(
      (i) =>
        i.status === "verified" ||
        i.status === "done" ||
        i.status === "wont_fix",
    );
    let status: ControlStatus["status"] = "no-findings";
    if (matches.length > 0) {
      status = open.length > 0 ? "findings-open" : "findings-resolved";
    }
    return {
      controlId: control.id,
      title: control.title,
      summary: control.summary,
      status,
      evidenceCount: matches.length,
      openIssues: open.map((i) => i.id),
      resolvedIssues: resolved.map((i) => i.id),
    };
  });

  return {
    framework,
    controls,
    summary: {
      total: controls.length,
      clean: controls.filter((c) => c.status === "no-findings").length,
      withOpenFindings: controls.filter((c) => c.status === "findings-open")
        .length,
      withResolvedFindings: controls.filter(
        (c) => c.status === "findings-resolved",
      ).length,
    },
  };
}

/** Render the compliance report as a markdown document. */
export function renderComplianceMarkdown(report: ComplianceReport): string {
  const lines: string[] = [];
  lines.push(`# Compliance report — ${report.framework.name}`);
  lines.push("");
  lines.push(`Framework: **${report.framework.name}**`);
  lines.push(`Version: ${report.framework.version}`);
  lines.push(`Reference: ${report.framework.url}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Total controls covered: ${report.summary.total}`);
  lines.push(`- Controls with no findings: **${report.summary.clean}**`);
  lines.push(
    `- Controls with open findings: **${report.summary.withOpenFindings}**`,
  );
  lines.push(
    `- Controls with resolved findings: **${report.summary.withResolvedFindings}**`,
  );
  lines.push("");
  lines.push(
    `> Note: this mapping is a **scaffold**, not a certified audit.` +
      ` Use it to guide evidence collection; verification remains a` +
      ` human responsibility.`,
  );
  lines.push("");
  lines.push(`## Controls`);
  lines.push("");
  lines.push(`| ID | Title | Status | Evidence |`);
  lines.push(`|---|---|---|---|`);
  for (const c of report.controls) {
    const badge =
      c.status === "no-findings"
        ? "✓ clean"
        : c.status === "findings-resolved"
          ? "✓ resolved"
          : "⚠ open";
    lines.push(
      `| \`${c.controlId}\` | ${c.title} | ${badge} | ${c.evidenceCount} issue(s) |`,
    );
  }
  lines.push("");
  for (const c of report.controls) {
    lines.push(`### ${c.controlId} · ${c.title}`);
    lines.push("");
    lines.push(c.summary);
    lines.push("");
    if (c.openIssues.length > 0) {
      lines.push(`**Open findings:** ${c.openIssues.join(", ")}`);
      lines.push("");
    }
    if (c.resolvedIssues.length > 0) {
      lines.push(`**Resolved findings:** ${c.resolvedIssues.join(", ")}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}
