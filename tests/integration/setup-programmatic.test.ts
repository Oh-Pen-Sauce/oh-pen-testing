import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffold } from "@oh-pen-testing/core";
import { ConfigSchema, loadConfig, writeConfig } from "@oh-pen-testing/shared";

/**
 * Effect-level test mirroring what the web wizard does across its 5 steps.
 * We bypass the server-action wrappers (which call `revalidatePath` and
 * need a Next request context) and exercise the underlying shared helpers
 * directly — the same ones the actions delegate to.
 */
describe("setup wizard — programmatic step-through", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-wizard-"));
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("produces a ConfigSchema-valid config.yml after all 5 steps", async () => {
    await scaffold({ cwd, projectName: "wizard-test", languages: ["typescript"] });

    // Step 1: Provider
    let cfg = await loadConfig(cwd);
    cfg.ai.primary_provider = "ollama";
    cfg.ai.model = "kimi-k2.6";
    await writeConfig(cwd, ConfigSchema.parse(cfg));

    // Step 3: GitHub repo
    cfg = await loadConfig(cwd);
    cfg.git.repo = "Oh-Pen-Sauce/oh-pen-testing";
    await writeConfig(cwd, ConfigSchema.parse(cfg));

    // Step 4: Autonomy
    cfg = await loadConfig(cwd);
    cfg.agents.autonomy = "yolo";
    await writeConfig(cwd, ConfigSchema.parse(cfg));

    // Step 5: Risky toggles
    cfg = await loadConfig(cwd);
    cfg.scans.risky = { test_file_upload_malicious: true };
    await writeConfig(cwd, ConfigSchema.parse(cfg));

    // Verify
    const final = await loadConfig(cwd);
    expect(() => ConfigSchema.parse(final)).not.toThrow();
    expect(final.ai.primary_provider).toBe("ollama");
    expect(final.ai.model).toBe("kimi-k2.6");
    expect(final.git.repo).toBe("Oh-Pen-Sauce/oh-pen-testing");
    expect(final.agents.autonomy).toBe("yolo");
    expect(final.scans.risky).toEqual({ test_file_upload_malicious: true });
  });
});
