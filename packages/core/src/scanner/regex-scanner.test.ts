import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runRegexScan } from "./regex-scanner.js";
import type { WalkedFile } from "./file-walker.js";
import { BUILTIN_SECRETS_RULES } from "../playbook-runner/builtin-rules/secrets.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.resolve(
  HERE,
  "../../../../playbooks/core/secrets/hardcoded-secrets-scanner/tests",
);

async function loadFixtures(subdir: "positive" | "negative"): Promise<WalkedFile[]> {
  const dir = path.join(FIXTURES_ROOT, subdir);
  const entries = await fs.readdir(dir);
  const out: WalkedFile[] = [];
  for (const name of entries) {
    const abs = path.join(dir, name);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) continue;
    out.push({
      absolutePath: abs,
      relativePath: `${subdir}/${name}`,
      content: await fs.readFile(abs, "utf-8"),
    });
  }
  return out;
}

describe("regex scanner against secrets playbook fixtures", () => {
  it("flags at least one hit per positive fixture", async () => {
    const files = await loadFixtures("positive");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const hits = runRegexScan({
        playbookId: "secrets/hardcoded-secrets-scanner",
        rules: BUILTIN_SECRETS_RULES,
        files: [file],
      });
      expect(
        hits.length,
        `expected hits for ${file.relativePath}, got none`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("does not flag any negative fixture", async () => {
    const files = await loadFixtures("negative");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const hits = runRegexScan({
        playbookId: "secrets/hardcoded-secrets-scanner",
        rules: BUILTIN_SECRETS_RULES,
        files: [file],
      });
      expect(
        hits,
        `expected zero hits for ${file.relativePath}, got: ${hits.map((h) => h.ruleId).join(", ")}`,
      ).toEqual([]);
    }
  });
});
