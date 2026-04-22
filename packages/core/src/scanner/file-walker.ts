import fs from "node:fs/promises";
import path from "node:path";
import ignoreModule from "ignore";

// ignore v6 with NodeNext resolution sometimes wraps the callable in .default
type IgnoreFactory = () => {
  add(patterns: string | string[]): unknown;
  ignores(p: string): boolean;
};
const ignore: IgnoreFactory = (ignoreModule as unknown as IgnoreFactory) ||
  ((ignoreModule as unknown as { default: IgnoreFactory }).default);
type Ignore = ReturnType<IgnoreFactory>;

const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  ".ohpentesting",
  "dist",
  ".next",
  "build",
  ".turbo",
  "coverage",
  ".vitest-cache",
  ".pnpm-store",
  // Playbook fixture directories — every playbook we ship has
  // intentionally-vulnerable code under tests/positive/ (to exercise
  // the regex rules) and intentionally-safe code under tests/negative/.
  // Without this, running Oh Pen Testing against its own source repo
  // (or any repo that adopts this convention for its own playbooks)
  // produces dozens of spurious "findings" — the scanner correctly
  // matching on code that was literally written to be caught.
  // Matches both the bundled core set and any user-authored playbooks
  // that follow the same tests/positive + tests/negative layout.
  "playbooks/**/tests/positive",
  "playbooks/**/tests/negative",
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".ogg",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".class",
  ".jar",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
]);

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  content: string;
  sha?: string;
}

async function buildIgnore(root: string): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORES);
  try {
    const gi = await fs.readFile(path.join(root, ".gitignore"), "utf-8");
    ig.add(gi);
  } catch {
    // ok — no .gitignore
  }
  return ig;
}

export async function* walkFiles(
  root: string,
): AsyncGenerator<WalkedFile> {
  const ig = await buildIgnore(root);

  async function* recurse(dir: string): AsyncGenerator<WalkedFile> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs);
      // Never try to ignore-check root itself
      if (rel === "") continue;
      const relForIgnore = entry.isDirectory() ? `${rel}/` : rel;
      if (ig.ignores(relForIgnore)) continue;
      if (entry.isDirectory()) {
        yield* recurse(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXT.has(ext)) continue;
      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_SIZE) continue;
      let content: string;
      try {
        content = await fs.readFile(abs, "utf-8");
      } catch {
        continue;
      }
      yield {
        absolutePath: abs,
        relativePath: rel,
        content,
      };
    }
  }

  yield* recurse(root);
}
