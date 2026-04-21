import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runScan, scaffold } from "@oh-pen-testing/core";
import {
  loadConfig,
  ScopeViolation,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
  type RateLimitStrategy,
} from "@oh-pen-testing/shared";

const BUNDLED_PLAYBOOKS = path.resolve(__dirname, "../../playbooks/core");

function neverCalledProvider(): AIProvider {
  return {
    id: "never",
    name: "must not be called",
    capabilities: [],
    rateLimitStrategy: (): RateLimitStrategy => ({ class: "local" }),
    async complete(_: CompletionRequest): Promise<CompletionResult> {
      throw new Error(
        "Provider should never be reached — scope gate must block first.",
      );
    },
  };
}

describe("authorisation gate", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-authgate-"));
    await fs.mkdir(path.join(cwd, "src"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "src", "config.ts"),
      'export const key = "AKIAIOSFODNN7EXAMPLE";\n',
      "utf-8",
    );
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("refuses to scan when authorisation_acknowledged is false", async () => {
    await scaffold({
      cwd,
      projectName: "authgate",
      languages: ["typescript"],
      // no authorisationAcknowledged — defaults to false
    });
    const config = await loadConfig(cwd);
    expect(config.scope.authorisation_acknowledged).toBe(false);

    await expect(
      runScan({
        cwd,
        config,
        provider: neverCalledProvider(),
        playbookRoots: [BUNDLED_PLAYBOOKS],
      }),
    ).rejects.toMatchObject({
      name: "ScopeViolation",
      kind: "authorisation_not_acknowledged",
    });
  });

  it("proceeds when authorisation_acknowledged is true", async () => {
    await scaffold({
      cwd,
      projectName: "authgate",
      languages: ["typescript"],
      authorisationAcknowledged: true,
    });
    const config = await loadConfig(cwd);
    expect(config.scope.authorisation_acknowledged).toBe(true);
    expect(config.scope.authorisation_acknowledged_at).not.toBeNull();

    const provider: AIProvider = {
      id: "stub",
      name: "stub",
      capabilities: [],
      rateLimitStrategy: () => ({ class: "local" }),
      async complete() {
        return {
          text: JSON.stringify({
            confirmed: true,
            severity: "critical",
            reasoning: "leaked",
          }),
          stopReason: "end_turn" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
          model: "stub",
        };
      },
    };

    const result = await runScan({
      cwd,
      config,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS],
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
  });
});
