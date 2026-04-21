import { describe, expect, it } from "vitest";
import { buildSarifLog, TOOL_DRIVER_NAME, TOOL_INFO_URI } from "./sarif.js";
import type { Issue } from "./models/issue.js";
import type { ScanRun } from "./models/scan.js";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "ISSUE-001",
    title: "AWS access key in src/config.ts",
    severity: "critical",
    cwe: ["CWE-798"],
    owasp_category: "A02:2021",
    status: "backlog",
    assignee: null,
    discovered_at: "2026-04-21T12:00:00Z",
    discovered_by: "playbook:secrets/hardcoded-secrets-scanner/aws-access-key-id",
    scan_id: "SCAN-001",
    location: { file: "src/config.ts", line_range: [2, 2] },
    evidence: {
      rule_id: "aws-access-key-id",
      code_snippet: "const key = 'AKIAIOSFODNN7EXAMPLE'",
      match_position: { line: 2, column: 12, length: 20 },
      analysis: "Hardcoded AWS access key detected.",
      ai_reasoning: "AWS documented example key, still shouldn't be literal.",
      ai_model: "claude-code-cli",
      ai_confidence: "high",
    },
    linked_pr: null,
    verification: {
      last_run_scan_id: null,
      last_run_at: null,
      hits_remaining: null,
      verified_at: null,
    },
    comments: [],
    ...overrides,
  };
}

const mockScan: ScanRun = {
  id: "SCAN-001",
  started_at: "2026-04-21T12:00:00Z",
  ended_at: "2026-04-21T12:01:00Z",
  triggered_by: "cli",
  playbooks_run: 1,
  playbooks_skipped: 0,
  issues_found: 1,
  issues_remediated: 0,
  ai_calls: 1,
  tokens_spent: 100,
  cost_usd: 0.01,
  provider: "claude-code-cli",
  checkpoint: null,
  status: "completed",
};

describe("buildSarifLog", () => {
  it("emits valid SARIF 2.1.0 shell with tool driver metadata", () => {
    const log = buildSarifLog({
      issues: [makeIssue()],
      scan: mockScan,
      toolVersion: "0.2.0",
    });
    expect(log.version).toBe("2.1.0");
    expect(log.$schema).toContain("sarif-schema-2.1.0.json");
    expect(log.runs).toHaveLength(1);
    const run = log.runs[0]!;
    expect(run.tool.driver.name).toBe(TOOL_DRIVER_NAME);
    expect(run.tool.driver.version).toBe("0.2.0");
    expect(run.tool.driver.informationUri).toBe(TOOL_INFO_URI);
  });

  it("maps severity → SARIF level correctly", () => {
    const issues = [
      makeIssue({ id: "ISSUE-001", severity: "critical" }),
      makeIssue({ id: "ISSUE-002", severity: "high" }),
      makeIssue({ id: "ISSUE-003", severity: "medium" }),
      makeIssue({ id: "ISSUE-004", severity: "low" }),
      makeIssue({ id: "ISSUE-005", severity: "info" }),
    ];
    const log = buildSarifLog({
      issues,
      scan: mockScan,
      toolVersion: "0.2.0",
    });
    const levels = log.runs[0]!.results.map((r) => r.level);
    expect(levels).toEqual(["error", "error", "warning", "note", "none"]);
  });

  it("deduplicates rules by id", () => {
    const log = buildSarifLog({
      issues: [
        makeIssue({ id: "ISSUE-001" }),
        makeIssue({ id: "ISSUE-002" }),
        makeIssue({ id: "ISSUE-003" }),
      ],
      scan: mockScan,
      toolVersion: "0.2.0",
    });
    expect(log.runs[0]!.tool.driver.rules).toHaveLength(1);
    expect(log.runs[0]!.tool.driver.rules[0]!.id).toBe("aws-access-key-id");
  });

  it("includes issue metadata in result properties", () => {
    const log = buildSarifLog({
      issues: [makeIssue()],
      scan: mockScan,
      toolVersion: "0.2.0",
    });
    const result = log.runs[0]!.results[0]!;
    expect(result.properties?.issueId).toBe("ISSUE-001");
    expect(result.properties?.severity).toBe("critical");
    expect(result.properties?.owaspCategory).toBe("A02:2021");
    expect(result.properties?.cwe).toEqual(["CWE-798"]);
    expect(result.properties?.aiModel).toBe("claude-code-cli");
    expect(result.properties?.aiConfidence).toBe("high");
  });

  it("encodes location with file, line range, and snippet", () => {
    const log = buildSarifLog({
      issues: [makeIssue()],
      scan: mockScan,
      toolVersion: "0.2.0",
    });
    const loc = log.runs[0]!.results[0]!.locations[0]!;
    expect(loc.physicalLocation.artifactLocation.uri).toBe("src/config.ts");
    expect(loc.physicalLocation.region.startLine).toBe(2);
    expect(loc.physicalLocation.region.endLine).toBe(2);
    expect(loc.physicalLocation.region.snippet?.text).toContain("AKIA");
  });
});
