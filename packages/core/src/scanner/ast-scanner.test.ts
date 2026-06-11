import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { runAstScan, hasBuiltinAstCheck } from "./ast-scanner.js";
import type { WalkedFile } from "./file-walker.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAYBOOK_ID = "owasp/a03-injection/code-injection-eval";
const PLAYBOOK_DIR = path.resolve(
  HERE,
  "../../../../playbooks/core/owasp/a03-injection/code-injection-eval",
);

async function loadFixtures(sub: "positive" | "negative"): Promise<WalkedFile[]> {
  const dir = path.join(PLAYBOOK_DIR, "tests", sub);
  const names = await fs.readdir(dir);
  const out: WalkedFile[] = [];
  for (const n of names) {
    const abs = path.join(dir, n);
    out.push({
      absolutePath: abs,
      relativePath: `tests/${sub}/${n}`,
      content: await fs.readFile(abs, "utf-8"),
    });
  }
  return out;
}

describe("runAstScan: code-injection-eval", () => {
  it("has a built-in check registered for the playbook", () => {
    expect(hasBuiltinAstCheck(PLAYBOOK_ID)).toBe(true);
  });

  it("flags every positive fixture (non-literal eval / new Function)", async () => {
    const files = await loadFixtures("positive");
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const hits = runAstScan({ playbookId: PLAYBOOK_ID, files: [f] });
      expect(
        hits.length,
        `expected a hit for ${f.relativePath}`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("does not flag any negative fixture (literal arguments)", async () => {
    const files = await loadFixtures("negative");
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const hits = runAstScan({ playbookId: PLAYBOOK_ID, files: [f] });
      expect(hits, `unexpected hit for ${f.relativePath}`).toEqual([]);
    }
  });

  it("returns [] for a playbook with no built-in check", () => {
    expect(
      runAstScan({ playbookId: "owasp/made-up/none", files: [] }),
    ).toEqual([]);
  });

  it("ignores non-JS/TS files", () => {
    const file: WalkedFile = {
      absolutePath: "/x/a.py",
      relativePath: "a.py",
      content: "eval(user_input)",
    };
    expect(runAstScan({ playbookId: PLAYBOOK_ID, files: [file] })).toEqual([]);
  });
});
