import { describe, it, expect } from "vitest";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAgentProfile, loadAllAgentProfiles, AGENT_IDS } from "./loader.js";

describe("agents loader", () => {
  it("resolves the bundled assets dir and loads memory.md for every agent", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "agents-loader-"));
    try {
      const profiles = await loadAllAgentProfiles(cwd);
      expect(profiles).toHaveLength(AGENT_IDS.length);
      for (const p of profiles) {
        expect(p.memory.length).toBeGreaterThan(50);
        expect(p.memorySource).toBe("bundled");
        expect(p.memoryPath).toContain(p.id);
        expect(p.memoryPath.endsWith("memory.md")).toBe(true);
      }
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  it("project memory.md beats bundled", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "agents-loader-"));
    try {
      const overrideDir = path.join(cwd, ".ohpentesting", "agents", "marinara");
      await fs.mkdir(overrideDir, { recursive: true });
      await fs.writeFile(
        path.join(overrideDir, "memory.md"),
        "# project memory\n",
        "utf-8",
      );
      const profile = await loadAgentProfile(cwd, "marinara");
      expect(profile.memorySource).toBe("project");
      expect(profile.memory).toContain("project memory");
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});
