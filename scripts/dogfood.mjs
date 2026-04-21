#!/usr/bin/env node
// scripts/dogfood.mjs — runs the regex layer of Oh Pen Testing against itself.
//
// Goal: confirm that none of our OWASP playbooks flag anything real in our
// own source tree. Fixture files (playbooks/core/**/tests/positive/*) are
// allowlisted because they're *designed* to match.
//
// This runs offline (no AI), so it's cheap enough for every CI run.

import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import {
  loadPlaybooks,
  runRegexScan,
  walkFiles,
  getBuiltinRules,
} from "@oh-pen-testing/core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const PLAYBOOKS_ROOT = path.join(REPO_ROOT, "playbooks", "core");

const ALLOWLIST_PREFIXES = [
  "playbooks/core/",                       // fixtures are meant to match
  "docs/",                                 // examples in docs
  "tests/",                                // integration tests use documented AWS dummy
  "PRD.md",
  "FUTURE_FEATURES.md",
  "CHANGELOG.md",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "scripts/dogfood.mjs",
  "Formula/",
];

// Explicit per-file allowlist for test files outside `tests/`.
const ALLOWLIST_FILES = new Set([
  "packages/shared/src/sarif.test.ts",
]);

function allowlisted(relPath) {
  if (ALLOWLIST_FILES.has(relPath)) return true;
  return ALLOWLIST_PREFIXES.some((p) => relPath.startsWith(p));
}

async function main() {
  const playbooks = await loadPlaybooks([PLAYBOOKS_ROOT]);
  const regexPlaybooks = playbooks.filter((p) => p.manifest.type === "regex");
  console.log(`Loaded ${regexPlaybooks.length} regex playbooks.`);

  const files = [];
  for await (const f of walkFiles(REPO_ROOT)) {
    if (allowlisted(f.relativePath)) continue;
    files.push(f);
  }
  console.log(`Scanning ${files.length} files (after allowlist).`);

  const hits = [];
  for (const playbook of regexPlaybooks) {
    const rules =
      playbook.manifest.rules.length > 0
        ? playbook.manifest.rules
        : getBuiltinRules(playbook.manifest.id);
    if (rules.length === 0) continue;
    const found = runRegexScan({
      playbookId: playbook.manifest.id,
      rules,
      files,
    });
    hits.push(...found);
  }

  if (hits.length === 0) {
    console.log("✓ dogfood clean — no findings in our own source.");
    process.exit(0);
  }

  console.log(`✗ ${hits.length} finding(s) need attention:`);
  for (const hit of hits) {
    console.log(
      `  [${hit.playbookId}/${hit.ruleId}] ${hit.file}:${hit.line}  ${hit.match.slice(0, 80)}`,
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("dogfood failed:", err);
  process.exit(2);
});
