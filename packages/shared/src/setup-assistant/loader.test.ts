import { describe, it, expect, beforeEach } from "vitest";
import {
  loadSetupAssistantBundle,
  __clearSetupAssistantCache,
} from "./loader.js";

beforeEach(() => {
  __clearSetupAssistantCache();
});

describe("setup-assistant loader", () => {
  it("loads memory + every skill from disk", () => {
    const bundle = loadSetupAssistantBundle();
    expect(bundle.memory.length).toBeGreaterThan(500);
    expect(bundle.memory).toContain("Marinara");
    expect(bundle.skills.length).toBeGreaterThanOrEqual(6);
  });

  it("every skill has a unique id and valid frontmatter", () => {
    const bundle = loadSetupAssistantBundle();
    const ids = new Set<string>();
    for (const s of bundle.skills) {
      expect(s.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.whenToUse.length).toBeGreaterThan(0);
      expect(s.inputSchema.type).toBe("object");
      expect(s.body.length).toBeGreaterThan(50);
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
    }
  });

  it("exposes the acknowledge_authorisation skill (the hard gate)", () => {
    const bundle = loadSetupAssistantBundle();
    const skill = bundle.skills.find(
      (s) => s.id === "acknowledge_authorisation",
    );
    expect(skill).toBeDefined();
    expect(skill!.inputSchema.required).toContain("actor_name");
  });

  it("memoises the bundle", () => {
    const a = loadSetupAssistantBundle();
    const b = loadSetupAssistantBundle();
    expect(a).toBe(b);
  });
});
