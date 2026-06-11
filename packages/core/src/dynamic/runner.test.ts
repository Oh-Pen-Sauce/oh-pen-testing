import { describe, it, expect } from "vitest";
import {
  buildDefaultConfig,
  ScopeViolation,
  type Config,
} from "@oh-pen-testing/shared";
import { runDynamicScan, buildDynamicIssue } from "./runner.js";
import type { DynamicFinding, DynamicPlaybook } from "./types.js";

function cfg(scopeOverrides: Partial<Config["scope"]> = {}): Config {
  const c = buildDefaultConfig({
    projectName: "t",
    languages: ["typescript"],
    preferredProvider: "claude-code-cli",
  });
  c.scope.authorisation_acknowledged = true;
  c.scope.allowed_targets = ["https://staging.local"];
  Object.assign(c.scope, scopeOverrides);
  return c;
}

const sampleFinding: DynamicFinding = {
  playbookId: "wstg/open-redirect",
  ruleId: "reflected-location",
  severity: "high",
  title: "Open redirect on /go",
  evidence: {
    request: { method: "GET", path: "/go?next=//evil" },
    response: { status: 302, headers: { location: "//evil" } },
    analysis: "Location header reflected an attacker-controlled host.",
  },
};

function fakePlaybook(findings: DynamicFinding[]): DynamicPlaybook {
  return {
    id: "fake",
    severity_default: "high",
    description: "test",
    run: async () => findings,
  };
}

describe("runDynamicScan scope gates", () => {
  it("refuses when authorisation is not acknowledged", async () => {
    const c = cfg({ authorisation_acknowledged: false });
    await expect(
      runDynamicScan(c, { baseUrl: "https://staging.local" }, []),
    ).rejects.toThrowError(ScopeViolation);
  });

  it("refuses a target not in allowed_targets", async () => {
    const c = cfg({ allowed_targets: ["https://other.local"] });
    await expect(
      runDynamicScan(c, { baseUrl: "https://staging.local" }, []),
    ).rejects.toThrowError(ScopeViolation);
  });

  it("aggregates findings from playbooks for an allowed target", async () => {
    const findings = await runDynamicScan(
      cfg(),
      { baseUrl: "https://staging.local" },
      [fakePlaybook([sampleFinding])],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("Open redirect on /go");
  });

  it("blocks a probe that tries to escape the allowed origin", async () => {
    const escaper: DynamicPlaybook = {
      id: "escaper",
      severity_default: "high",
      description: "tries to reach another host",
      run: async (ctx) => {
        // An absolute URL to a different origin must be refused before
        // any request leaves the machine.
        await ctx.fetch({ method: "GET", path: "https://evil.local/steal" });
        return [];
      },
    };
    await expect(
      runDynamicScan(cfg(), { baseUrl: "https://staging.local" }, [escaper]),
    ).rejects.toThrowError(ScopeViolation);
  });
});

describe("buildDynamicIssue", () => {
  it("maps a dynamic finding to an issue with safe remediation defaults", () => {
    const issue = buildDynamicIssue(
      { ...sampleFinding, cwe: ["CWE-601"], owaspRef: "A01:2021" },
      "SCAN-001",
      "ISSUE-001",
      "2026-06-11T00:00:00Z",
    );
    expect(issue.id).toBe("ISSUE-001");
    expect(issue.scan_id).toBe("SCAN-001");
    expect(issue.severity).toBe("high");
    expect(issue.cwe).toEqual(["CWE-601"]);
    expect(issue.owasp_category).toBe("A01:2021");
    expect(issue.discovered_by).toContain("wstg/open-redirect");
    // Runtime findings are never auto-patchable and always need a human.
    expect(issue.remediation?.auto_fixable).toBe(false);
    expect(issue.remediation?.requires_approval).toBe(true);
  });

  it("defaults cwe to [] when the finding carries none", () => {
    const issue = buildDynamicIssue(
      sampleFinding,
      "SCAN-002",
      "ISSUE-002",
      "2026-06-11T00:00:00Z",
    );
    expect(issue.cwe).toEqual([]);
    expect(issue.owasp_category).toBeUndefined();
  });
});
