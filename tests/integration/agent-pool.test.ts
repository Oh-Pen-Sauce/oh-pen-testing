import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  evaluateAutonomyGate,
  scaffold,
  pickAgentForPlaybook,
  KNOWN_AGENTS,
  AGENT_IDS,
  approveGatedIssue,
} from "@oh-pen-testing/core";
import {
  IssueSchema,
  loadConfig,
  writeIssue,
  type Issue,
} from "@oh-pen-testing/shared";

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return IssueSchema.parse({
    id: "ISSUE-001",
    title: "test",
    severity: "medium",
    cwe: [],
    status: "pending_approval",
    discovered_at: new Date().toISOString(),
    discovered_by: "playbook:test/rule",
    scan_id: "SCAN-001",
    location: { file: "x.ts", line_range: [1, 1] },
    evidence: { code_snippet: "x", analysis: "y" },
    remediation: { strategy: "test", auto_fixable: true },
    ...overrides,
  });
}

describe("agent-pool: agent roster", () => {
  it("registers all 4 pasta agents", () => {
    expect(AGENT_IDS.sort()).toEqual(
      ["alfredo", "carbonara", "marinara", "pesto"].sort(),
    );
    for (const id of AGENT_IDS) {
      expect(KNOWN_AGENTS[id]).toBeTruthy();
      expect(KNOWN_AGENTS[id]?.emoji).toBeTruthy();
      expect(KNOWN_AGENTS[id]?.specialties.length).toBeGreaterThan(0);
    }
  });

  it("pickAgentForPlaybook routes injection → marinara", () => {
    expect(pickAgentForPlaybook("owasp/a03-injection/sql-injection-raw").id).toBe(
      "marinara",
    );
    expect(pickAgentForPlaybook("secrets/hardcoded-secrets-scanner").id).toBe(
      "marinara",
    );
  });

  it("pickAgentForPlaybook routes crypto → carbonara", () => {
    expect(
      pickAgentForPlaybook("owasp/a02-cryptographic-failures/weak-hash-algorithm")
        .id,
    ).toBe("carbonara");
  });

  it("pickAgentForPlaybook routes access-control → alfredo", () => {
    expect(
      pickAgentForPlaybook(
        "owasp/a01-broken-access-control/missing-authorisation-check",
      ).id,
    ).toBe("alfredo");
  });

  it("pickAgentForPlaybook routes SCA → pesto", () => {
    expect(pickAgentForPlaybook("owasp/a06-vulnerable-components/sca").id).toBe(
      "pesto",
    );
  });
});

describe("agent-pool: autonomy gate", () => {
  async function baseConfig(autonomy: "yolo" | "recommended" | "careful") {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-autonomy-"));
    await scaffold({
      cwd,
      projectName: "autonomy-test",
      languages: ["typescript"],
      authorisationAcknowledged: true,
    });
    const config = await loadConfig(cwd);
    config.agents.autonomy = autonomy;
    return { cwd, config };
  }

  it("careful mode gates everything", async () => {
    const { config } = await baseConfig("careful");
    const issue = makeIssue({ severity: "low" });
    const gate = evaluateAutonomyGate(config, issue);
    expect(gate.allowed).toBe(false);
  });

  it("recommended mode gates critical issues", async () => {
    const { config } = await baseConfig("recommended");
    const issue = makeIssue({ severity: "critical" });
    const gate = evaluateAutonomyGate(config, issue);
    expect(gate.allowed).toBe(false);
  });

  it("recommended mode allows non-critical non-triggering issues", async () => {
    const { config } = await baseConfig("recommended");
    const issue = makeIssue({
      severity: "medium",
      title: "fix formatting",
      remediation: { strategy: "linting", auto_fixable: true },
    });
    const gate = evaluateAutonomyGate(config, issue);
    expect(gate.allowed).toBe(true);
  });

  it("recommended mode gates auth_changes trigger", async () => {
    const { config } = await baseConfig("recommended");
    const issue = makeIssue({
      severity: "medium",
      title: "Missing auth on /api/users",
      remediation: { strategy: "owasp/a01-broken-access-control/missing-authorisation-check", auto_fixable: true },
    });
    const gate = evaluateAutonomyGate(config, issue);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.reason).toContain("auth_changes");
  });

  it("yolo mode still gates secrets_rotation trigger", async () => {
    const { config } = await baseConfig("yolo");
    const issue = makeIssue({
      severity: "high",
      title: "Rotate leaked password",
      remediation: { strategy: "secrets-rotation", auto_fixable: true },
    });
    const gate = evaluateAutonomyGate(config, issue);
    expect(gate.allowed).toBe(false);
  });

  it("yolo mode allows normal critical findings", async () => {
    const { config } = await baseConfig("yolo");
    const issue = makeIssue({
      severity: "critical",
      title: "SQL injection in /search",
      remediation: { strategy: "sql-inject", auto_fixable: true },
    });
    const gate = evaluateAutonomyGate(config, issue);
    expect(gate.allowed).toBe(true);
  });
});

describe("agent-pool: approve flow", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-approve-"));
    await scaffold({
      cwd,
      projectName: "approve-test",
      languages: ["typescript"],
      authorisationAcknowledged: true,
    });
  });
  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("approveGatedIssue transitions pending_approval → ready and records the approver", async () => {
    const issue = makeIssue({
      status: "pending_approval",
      comments: [],
    });
    await writeIssue(cwd, issue);
    const updated = await approveGatedIssue(cwd, issue.id, "sam");
    expect(updated.status).toBe("ready");
    expect(updated.comments.some((c) => c.author === "sam")).toBe(true);
  });

  it("approveGatedIssue refuses to approve an issue not in pending_approval", async () => {
    const issue = makeIssue({ status: "done", comments: [] });
    await writeIssue(cwd, issue);
    await expect(approveGatedIssue(cwd, issue.id, "sam")).rejects.toThrow(
      /not pending approval/,
    );
  });
});
