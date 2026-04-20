import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffold } from "@oh-pen-testing/core";
import { loadConfig, ohpenPaths } from "@oh-pen-testing/shared";

describe("oh-pen-testing init", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-init-"));
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("creates .ohpentesting/ with expected structure", async () => {
    const result = await scaffold({ cwd, projectName: "test-project", languages: ["typescript"] });
    expect(result.configPath).toContain(".ohpentesting/config.yml");

    const paths = ohpenPaths(cwd);
    for (const dir of [paths.issues, paths.scans, paths.reports, paths.logs, paths.playbooksLocal]) {
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    }

    const config = await loadConfig(cwd);
    expect(config.project.name).toBe("test-project");
    expect(config.project.primary_languages).toEqual(["typescript"]);
    expect(config.version).toBe("0.5");
    expect(config.ai.model).toBe("claude-opus-4-7");
  });

  it("skips existing config without --force", async () => {
    await scaffold({ cwd, projectName: "first", languages: ["typescript"] });
    const result = await scaffold({ cwd, projectName: "second", languages: ["python"] });
    expect(result.skipped.some((p) => p.endsWith("config.yml"))).toBe(true);
    const config = await loadConfig(cwd);
    expect(config.project.name).toBe("first");
  });

  it("overwrites with --force", async () => {
    await scaffold({ cwd, projectName: "first", languages: ["typescript"] });
    await scaffold({ cwd, projectName: "second", languages: ["python"], overwrite: true });
    const config = await loadConfig(cwd);
    expect(config.project.name).toBe("second");
    expect(config.project.primary_languages).toEqual(["python"]);
  });
});
