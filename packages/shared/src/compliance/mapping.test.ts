import { describe, it, expect } from "vitest";
import { buildComplianceReport, renderComplianceMarkdown } from "./mapping.js";
import { IssueSchema, type Issue } from "../models/issue.js";

function makeIssue(partial: Partial<Issue> & { id: string }): Issue {
  return IssueSchema.parse({
    title: "test",
    severity: "high",
    cwe: [],
    status: "backlog",
    assignee: null,
    discovered_at: "2026-01-01T00:00:00Z",
    discovered_by: "playbook:owasp-top-10/a01-broken-access-control/test-rule",
    scan_id: "SCAN-001",
    location: { file: "app.ts", line_range: [1, 1] },
    evidence: {
      rule_id: "test-rule",
      code_snippet: "x",
      analysis: "x",
      ai_reasoning: "x",
      ai_model: "test",
      ai_confidence: "high",
    },
    remediation: {
      strategy: "test",
      auto_fixable: false,
      estimated_diff_size: 0,
      requires_approval: true,
    },
    linked_pr: null,
    verification: {
      last_run_scan_id: null,
      last_run_at: null,
      hits_remaining: null,
      verified_at: null,
    },
    comments: [],
    ...partial,
  });
}

describe("compliance mapping", () => {
  it("matches issues to SOC 2 CC6.1 by playbook id", () => {
    const issues = [
      makeIssue({
        id: "ISSUE-001",
        discovered_by:
          "playbook:owasp-top-10/a01-broken-access-control/rule-1",
      }),
    ];
    const report = buildComplianceReport("soc2", issues);
    const cc61 = report.controls.find((c) => c.controlId === "CC6.1");
    expect(cc61?.status).toBe("findings-open");
    expect(cc61?.openIssues).toEqual(["ISSUE-001"]);
  });

  it("matches issues to ISO 27001 A.8.24 by CWE", () => {
    const issues = [
      makeIssue({
        id: "ISSUE-002",
        cwe: ["CWE-327"],
        discovered_by: "playbook:custom/crypto-check/rule-1",
      }),
    ];
    const report = buildComplianceReport("iso27001", issues);
    const a824 = report.controls.find((c) => c.controlId === "A.8.24");
    expect(a824?.status).toBe("findings-open");
  });

  it("shows resolved when the only matching issue is verified", () => {
    const issues = [
      makeIssue({
        id: "ISSUE-003",
        status: "verified",
        discovered_by:
          "playbook:owasp-top-10/a01-broken-access-control/rule-1",
      }),
    ];
    const report = buildComplianceReport("soc2", issues);
    const cc61 = report.controls.find((c) => c.controlId === "CC6.1");
    expect(cc61?.status).toBe("findings-resolved");
  });

  it("shows no-findings when no issues touch the control", () => {
    const report = buildComplianceReport("soc2", []);
    for (const c of report.controls) {
      expect(c.status).toBe("no-findings");
    }
    expect(report.summary.clean).toBe(report.summary.total);
  });

  it("renders a markdown report with all controls", () => {
    const report = buildComplianceReport("pci-dss", []);
    const md = renderComplianceMarkdown(report);
    expect(md).toContain("PCI-DSS");
    expect(md).toContain("| ID | Title | Status | Evidence |");
  });
});
