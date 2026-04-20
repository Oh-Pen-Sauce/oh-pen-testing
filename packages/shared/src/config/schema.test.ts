import { describe, expect, it } from "vitest";
import { ConfigSchema } from "./schema.js";
import { buildDefaultConfig } from "./defaults.js";

describe("ConfigSchema", () => {
  it("accepts a valid default config", () => {
    const cfg = buildDefaultConfig({
      projectName: "test",
      languages: ["typescript"],
    });
    const result = ConfigSchema.safeParse(cfg);
    expect(result.success).toBe(true);
  });

  it("rejects invalid autonomy mode", () => {
    const cfg = buildDefaultConfig({
      projectName: "test",
      languages: ["typescript"],
    });
    (cfg.agents as any).autonomy = "speedrun";
    const result = ConfigSchema.safeParse(cfg);
    expect(result.success).toBe(false);
  });

  it("rejects bad repo format", () => {
    const cfg = buildDefaultConfig({
      projectName: "test",
      languages: ["typescript"],
    });
    cfg.git.repo = "not-a-valid-repo-string";
    const result = ConfigSchema.safeParse(cfg);
    expect(result.success).toBe(false);
  });

  it("rejects empty primary_languages", () => {
    const cfg = buildDefaultConfig({
      projectName: "test",
      languages: ["typescript"],
    });
    cfg.project.primary_languages = [];
    const result = ConfigSchema.safeParse(cfg);
    expect(result.success).toBe(false);
  });
});
