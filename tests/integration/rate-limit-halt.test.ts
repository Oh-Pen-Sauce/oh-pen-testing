import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AIProvider,
  CompletionRequest,
  CompletionResult,
  RateLimitStrategy,
} from "@oh-pen-testing/shared";
import { RateLimitError } from "@oh-pen-testing/shared";
import { createRateLimitManager } from "@oh-pen-testing/rate-limit";
import { runScan, scaffold, RateLimitHalt } from "@oh-pen-testing/core";
import { loadConfig } from "@oh-pen-testing/shared";

const BUNDLED_PLAYBOOKS = path.resolve(__dirname, "../../playbooks/core");

function providerThatAlwaysThrows(): AIProvider {
  return {
    id: "stub",
    name: "stub",
    capabilities: [],
    rateLimitStrategy(): RateLimitStrategy {
      return { class: "api-key", hardCapPct: 100, softCapPct: 50 };
    },
    async complete(_req: CompletionRequest): Promise<CompletionResult> {
      throw new RateLimitError("Simulated rate limit");
    },
  };
}

describe("rate-limit halt propagates through scan", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-ratelimit-"));
    await fs.mkdir(path.join(cwd, "src"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "src", "config.ts"),
      'export const key = "AKIAIOSFODNN7EXAMPLE";\n',
      "utf-8",
    );
    await scaffold({
      cwd,
      projectName: "ratelimit-test",
      languages: ["typescript"],
    });
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("throws RateLimitHalt when provider rate-limits mid-scan", async () => {
    const config = await loadConfig(cwd);
    const provider = providerThatAlwaysThrows();
    await expect(
      runScan({
        cwd,
        config,
        provider,
        playbookRoots: [BUNDLED_PLAYBOOKS],
      }),
    ).rejects.toBeInstanceOf(RateLimitHalt);
  });

  it("halts on pre-call hard cap without calling provider", async () => {
    const config = await loadConfig(cwd);
    let calls = 0;
    const provider: AIProvider = {
      id: "stub",
      name: "stub",
      capabilities: [],
      rateLimitStrategy: () => ({
        class: "api-key",
        hardCapPct: 100,
        softCapPct: 50,
      }),
      async complete(): Promise<CompletionResult> {
        calls++;
        return {
          text: "{}",
          stopReason: "end_turn",
          usage: { inputTokens: 1, outputTokens: 1 },
          model: "stub",
        };
      },
    };
    // Pre-exhausted manager
    const manager = createRateLimitManager({
      strategy: { class: "api-key", hardCapPct: 1, softCapPct: 1 },
      budgetUsd: 0.00001,
      costPerMillionInput: 1_000_000,
    });
    manager.afterCall({ inputTokens: 10, outputTokens: 10 });
    await expect(
      runScan({
        cwd,
        config,
        provider,
        playbookRoots: [BUNDLED_PLAYBOOKS],
        rateLimitManager: manager,
      }),
    ).rejects.toBeInstanceOf(RateLimitHalt);
    expect(calls).toBe(0);
  });
});
