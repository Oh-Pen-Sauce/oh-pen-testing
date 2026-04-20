import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { PlaybookManifestSchema, type PlaybookManifest } from "./manifest.js";

export interface LoadedPlaybook {
  manifest: PlaybookManifest;
  directory: string;
  scanPrompt?: string;
  remediatePrompt?: string;
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

async function walkPlaybooks(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const manifestPath = path.join(full, "manifest.yml");
        try {
          await fs.access(manifestPath);
          out.push(full);
          continue;
        } catch {
          await recurse(full);
        }
      }
    }
  }
  await recurse(root);
  return out;
}

export async function loadPlaybooks(roots: string[]): Promise<LoadedPlaybook[]> {
  const out: LoadedPlaybook[] = [];
  const seenIds = new Set<string>();
  for (const root of roots) {
    const dirs = await walkPlaybooks(root);
    for (const dir of dirs) {
      const manifestRaw = await fs.readFile(
        path.join(dir, "manifest.yml"),
        "utf-8",
      );
      const manifest = PlaybookManifestSchema.parse(parseYaml(manifestRaw));
      if (seenIds.has(manifest.id)) {
        // Local overrides core — skip if we already have one
        continue;
      }
      seenIds.add(manifest.id);
      const [scanPrompt, remediatePrompt] = await Promise.all([
        readIfExists(path.join(dir, "scan.prompt.md")),
        readIfExists(path.join(dir, "remediate.prompt.md")),
      ]);
      out.push({ manifest, directory: dir, scanPrompt, remediatePrompt });
    }
  }
  return out;
}

export function filterByLanguages(
  playbooks: LoadedPlaybook[],
  languages: string[],
): LoadedPlaybook[] {
  const set = new Set(languages);
  set.add("generic");
  return playbooks.filter((p) =>
    p.manifest.languages.some((l) => set.has(l)),
  );
}
