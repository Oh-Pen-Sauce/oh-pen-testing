import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runScan, runVerify, scaffold } from "@oh-pen-testing/core";
import {
  loadConfig,
  readIssue,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
} from "@oh-pen-testing/shared";

const BUNDLED_PLAYBOOKS = path.resolve(__dirname, "../../playbooks/core");

function confirmEverythingProvider(): AIProvider {
  return {
    id: "stub-confirm",
    name: "stub",
    capabilities: [],
    rateLimitStrategy: () => ({ class: "local" }),
    async complete(_: CompletionRequest): Promise<CompletionResult> {
      return {
        text: JSON.stringify({
          confirmed: true,
          severity: "medium",
          reasoning: "looks like a leaked key",
        }),
        stopReason: "end_turn",
        usage: { inputTokens: 1, outputTokens: 1 },
        model: "stub",
      };
    },
  };
}

describe("verification rerun", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-verify-"));
    await fs.mkdir(path.join(cwd, "src"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "src", "config.ts"),
      'export const awsKey = "AKIAIOSFODNN7EXAMPLE";\n',
      "utf-8",
    );
    await scaffold({
      cwd,
      projectName: "verify-test",
      languages: ["typescript"],
      authorisationAcknowledged: true,
    });
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("marks issue verified after the fix removes the hit", async () => {
    const config = await loadConfig(cwd);
    const provider = confirmEverythingProvider();
    const scan = await runScan({
      cwd,
      config,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS],
    });
    const issue = scan.issues[0]!;
    expect(issue.status).toBe("backlog");

    // Simulate the fix landing: remove the secret from the file
    await fs.writeFile(
      path.join(cwd, "src", "config.ts"),
      "export const awsKey = process.env.AWS_ACCESS_KEY_ID;\n",
      "utf-8",
    );

    const result = await runVerify({
      cwd,
      config,
      issueId: issue.id,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS],
      skipAiConfirm: true, // regex-only — secret is literally gone
    });
    expect(result.verified).toBe(true);
    expect(result.hitsRemaining).toBe(0);

    const saved = await readIssue(cwd, issue.id);
    expect(saved.status).toBe("verified");
    expect(saved.verification.verified_at).not.toBeNull();
    expect(saved.verification.hits_remaining).toBe(0);
  });

  it("leaves issue in_review when the fix didn't land", async () => {
    const config = await loadConfig(cwd);
    const provider = confirmEverythingProvider();
    const scan = await runScan({
      cwd,
      config,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS],
    });
    const issue = scan.issues[0]!;

    // File unchanged — the "fix" never happened
    const result = await runVerify({
      cwd,
      config,
      issueId: issue.id,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS],
      skipAiConfirm: true,
    });
    expect(result.verified).toBe(false);
    expect(result.hitsRemaining).toBeGreaterThanOrEqual(1);

    const saved = await readIssue(cwd, issue.id);
    expect(saved.status).not.toBe("verified");
    expect(saved.verification.verified_at).toBeNull();
    expect(saved.verification.hits_remaining).toBeGreaterThanOrEqual(1);
  });
});
