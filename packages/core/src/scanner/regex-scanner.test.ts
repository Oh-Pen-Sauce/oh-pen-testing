import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runRegexScan } from "./regex-scanner.js";
import type { WalkedFile } from "./file-walker.js";
import { BUILTIN_SECRETS_RULES } from "../playbook-runner/builtin-rules/secrets.js";
import { loadPlaybooks } from "../playbook-runner/loader.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAYBOOKS_ROOT = path.resolve(HERE, "../../../../playbooks/core");

/**
 * Auto-discovers every playbook directory under playbooks/core and exercises
 * its positive/negative fixtures against its declared regex rules.
 *
 * Gate contract (enforced for every playbook that ships a `tests/` dir):
 *  - every file in tests/positive/ MUST produce at least one regex hit
 *  - every file in tests/negative/ MUST produce zero regex hits
 *
 * Playbooks without a `tests/` dir are skipped (e.g. SCA playbooks that
 * shell out to external tools instead of running regex).
 */

async function loadFixtureFiles(
  dir: string,
): Promise<WalkedFile[]> {
  const out: WalkedFile[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const abs = path.join(dir, name);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) continue;
    out.push({
      absolutePath: abs,
      relativePath: path.basename(dir) + "/" + name,
      content: await fs.readFile(abs, "utf-8"),
    });
  }
  return out;
}

describe("playbook fixture gate — every playbook must satisfy its fixtures", async () => {
  const playbooks = await loadPlaybooks([PLAYBOOKS_ROOT]);
  const regexPlaybooks = playbooks.filter(
    (p) => p.manifest.type === "regex",
  );
  expect(regexPlaybooks.length).toBeGreaterThan(0);

  for (const playbook of regexPlaybooks) {
    const rules =
      playbook.manifest.rules.length > 0
        ? playbook.manifest.rules
        : playbook.manifest.id === "secrets/hardcoded-secrets-scanner"
          ? BUILTIN_SECRETS_RULES
          : [];

    describe(playbook.manifest.id, () => {
      const positiveDir = path.join(playbook.directory, "tests", "positive");
      const negativeDir = path.join(playbook.directory, "tests", "negative");

      it("at least one hit per positive fixture", async () => {
        const files = await loadFixtureFiles(positiveDir);
        if (files.length === 0) {
          // Playbooks without fixtures are skipped (and flagged).
          // eslint-disable-next-line no-console
          console.warn(
            `[fixture-gate] ${playbook.manifest.id}: no positive fixtures — add some under ${positiveDir}`,
          );
          return;
        }
        expect(rules.length).toBeGreaterThan(0);
        for (const file of files) {
          const hits = runRegexScan({
            playbookId: playbook.manifest.id,
            rules,
            files: [file],
          });
          expect(
            hits.length,
            `[${playbook.manifest.id}] expected hits for ${file.relativePath}, got none`,
          ).toBeGreaterThanOrEqual(1);
        }
      });

      it("zero hits against every negative fixture", async () => {
        const files = await loadFixtureFiles(negativeDir);
        if (files.length === 0) return;
        for (const file of files) {
          const hits = runRegexScan({
            playbookId: playbook.manifest.id,
            rules,
            files: [file],
          });
          expect(
            hits,
            `[${playbook.manifest.id}] expected zero hits for ${file.relativePath}, got: ${hits
              .map((h) => h.ruleId)
              .join(", ")}`,
          ).toEqual([]);
        }
      });
    });
  }
});
