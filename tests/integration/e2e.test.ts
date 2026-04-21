import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadConfig,
  readIssue,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
} from "@oh-pen-testing/shared";
import { runScan, runAgent, scaffold } from "@oh-pen-testing/core";
import type { RemediationAdapter } from "@oh-pen-testing/core";

const BUNDLED_PLAYBOOKS = path.resolve(
  __dirname,
  "../../playbooks/core",
);

interface StubProviderBehaviour {
  confirmResponse?: string;
  remediationResponse?: string;
}

function stubProvider(behaviour: StubProviderBehaviour = {}): AIProvider {
  const calls: CompletionRequest[] = [];
  return {
    id: "stub",
    name: "Stub provider",
    capabilities: [],
    rateLimitStrategy: () => ({ class: "api-key", softCapPct: 50, hardCapPct: 100 }),
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      calls.push(req);
      const messageText =
        req.messages[req.messages.length - 1]?.content ?? "";
      const isRemediation = messageText.includes("<issue_evidence>");
      const text = isRemediation
        ? behaviour.remediationResponse ??
          JSON.stringify({
            patched_file_contents:
              'export const awsConfig = {\n  accessKeyId: process.env.AWS_ACCESS_KEY_ID,\n};\n',
            explanation_of_fix:
              "Replaced the hardcoded AWS access key with a reference to process.env.AWS_ACCESS_KEY_ID so the secret is sourced from the environment.",
            env_var_name: "AWS_ACCESS_KEY_ID",
            env_example_addition: "AWS_ACCESS_KEY_ID=your-aws-access-key-here",
          })
        : behaviour.confirmResponse ??
          JSON.stringify({
            confirmed: true,
            severity: "critical",
            reasoning: "Literal AWS access key in source file.",
          });
      return {
        text,
        stopReason: "end_turn",
        usage: { inputTokens: 10, outputTokens: 20 },
        model: "stub",
      };
    },
  };
}

function stubAdapter(): {
  adapter: RemediationAdapter;
  calls: Array<{ branchName: string }>;
} {
  const calls: Array<{ branchName: string }> = [];
  return {
    adapter: {
      async createRemediationPr(input) {
        calls.push({ branchName: input.branchName });
        return {
          number: 42,
          url: "https://github.com/Oh-Pen-Sauce/test/pull/42",
          nodeId: "PR_stub_node_id",
        };
      },
    },
    calls,
  };
}

describe("end-to-end scan + remediate (mocked)", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-e2e-"));
    await fs.mkdir(path.join(cwd, "src"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "src", "config.ts"),
      'export const awsConfig = {\n  accessKeyId: "AKIAIOSFODNN7EXAMPLE",\n};\n',
      "utf-8",
    );
    await scaffold({
      cwd,
      projectName: "e2e-sandbox",
      languages: ["typescript"],
      authorisationAcknowledged: true,
    });
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("scans a hardcoded secret and lands an issue file", async () => {
    const config = await loadConfig(cwd);
    const provider = stubProvider();
    const result = await runScan({
      cwd,
      config,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS],
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    const issue = result.issues[0]!;
    expect(issue.severity).toBe("critical");
    expect(issue.location.file).toBe("src/config.ts");
    const saved = await readIssue(cwd, issue.id);
    expect(saved.id).toBe(issue.id);
  });

  it("remediates the issue and returns a PR URL with expected side effects", async () => {
    const config = await loadConfig(cwd);
    const provider = stubProvider();
    const { adapter, calls } = stubAdapter();

    const scan = await runScan({
      cwd,
      config,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS],
    });
    const issue = scan.issues[0]!;

    const remediation = await runAgent({
      issueId: issue.id,
      agentId: "marinara",
      cwd,
      config,
      provider,
      adapter,
      playbookRoots: [BUNDLED_PLAYBOOKS],
      repoPath: cwd,
    });

    expect(remediation.prUrl).toContain("github.com");
    expect(remediation.prNumber).toBe(42);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.branchName.startsWith("ohpen/issue-")).toBe(true);

    // The patched file should no longer contain the literal secret
    const patched = await fs.readFile(
      path.join(cwd, "src", "config.ts"),
      "utf-8",
    );
    expect(patched).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(patched).toContain("process.env.AWS_ACCESS_KEY_ID");

    // .env.example should have been created with the env var name
    const envExample = await fs.readFile(
      path.join(cwd, ".env.example"),
      "utf-8",
    );
    expect(envExample).toContain("AWS_ACCESS_KEY_ID");

    // Issue JSON should record the PR and move to in_review
    const saved = await readIssue(cwd, issue.id);
    expect(saved.status).toBe("in_review");
    expect(saved.linked_pr).toBe(remediation.prUrl);
  });
});
