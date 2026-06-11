import { describe, expect, it } from "vitest";
import { screenRetriedPatch, changedLineCount } from "./run-agent.js";

describe("screenRetriedPatch", () => {
  it("passes a benign fix", () => {
    const before = "const q = `SELECT * FROM t WHERE id = ${id}`;\n";
    const after = "const q = 'SELECT * FROM t WHERE id = ?';\n";
    expect(screenRetriedPatch(before, after)).toEqual({ safe: true });
  });

  it("flags a newly introduced eval(", () => {
    const before = "export const x = 1;\n";
    const after = "export const x = eval(userInput);\n";
    const r = screenRetriedPatch(before, after);
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.reason).toContain("eval(");
  });

  it("flags a newly introduced new Function(", () => {
    const before = "export const x = 1;\n";
    const after = "export const x = new Function('return 1')();\n";
    expect(screenRetriedPatch(before, after).safe).toBe(false);
  });

  it("flags a newly introduced document.write(", () => {
    const before = "el.textContent = name;\n";
    const after = "document.write(name);\n";
    expect(screenRetriedPatch(before, after).safe).toBe(false);
  });

  it("does NOT flag eval that was already present in the original", () => {
    // The fix shouldn't be blamed for an eval the original already had,
    // as long as it doesn't add a new one.
    const before = "const a = eval(x);\nvar danger = 1;\n";
    const after = "const a = eval(x);\nconst danger = 1;\n";
    expect(screenRetriedPatch(before, after)).toEqual({ safe: true });
  });

  it("flags a SECOND introduced eval even if the original had one", () => {
    const before = "const a = eval(x);\n";
    const after = "const a = eval(x);\nconst b = eval(y);\n";
    expect(screenRetriedPatch(before, after).safe).toBe(false);
  });

  it("flags a suspicious size explosion", () => {
    const before = "export const x = 1;\n";
    const after = before + "y".repeat(5000);
    expect(screenRetriedPatch(before, after).safe).toBe(false);
  });
});

describe("changedLineCount", () => {
  it("is 0 for identical content", () => {
    const s = "a\nb\nc\n";
    expect(changedLineCount(s, s)).toBe(0);
  });

  it("counts a single changed line as a small number", () => {
    const before = "a\nb\nc\n";
    const after = "a\nB\nc\n";
    // b -> B differs at one index: counted once on each side.
    expect(changedLineCount(before, after)).toBe(2);
  });

  it("scores a near-total rewrite high", () => {
    const before = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    const after = Array.from({ length: 100 }, (_, i) => `LINE ${i}`).join("\n");
    expect(changedLineCount(before, after)).toBe(200);
  });
});
