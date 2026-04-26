import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildDefaultConfig,
  ohpenPaths,
  writeConfig,
  type Language,
  type Framework,
  type ProviderId,
} from "@oh-pen-testing/shared";

const exec = promisify(execFile);

export interface ScaffoldOptions {
  cwd: string;
  overwrite?: boolean;
  projectName?: string;
  languages?: Language[];
  /**
   * Pre-set the authorisation acknowledgement. Primarily for tests and
   * programmatic setups. In production, this is false by default so the
   * setup wizard or CLI prompt can capture it interactively.
   */
  authorisationAcknowledged?: boolean;
}

export interface ScaffoldResult {
  created: string[];
  skipped: string[];
  configPath: string;
}

const PRE_COMMIT_HOOK_MARKER = "# oh-pen-testing: block credential files";
const PRE_COMMIT_HOOK_BODY = `#!/bin/sh
${PRE_COMMIT_HOOK_MARKER}
if git diff --cached --name-only | grep -qE '\\.ohpentesting/credentials'; then
  echo "ERROR: oh-pen-testing blocks commits that include .ohpentesting/credentials* files." >&2
  echo "Store credentials in env vars or the OS keychain, not in the repo." >&2
  exit 1
fi
`;

const OHPEN_GITIGNORE = `# oh-pen-testing
logs/
credentials*
.counter.json
`;

/**
 * Block we append to the user's ROOT .gitignore. Must be a single
 * line so we can do a substring `.includes(".ohpentesting")` check
 * for idempotency without false-matching some other config block.
 * Comment is on the same line so a casual reader can see why the
 * entry is there.
 */
const ROOT_GITIGNORE_MARKER =
  ".ohpentesting/ # oh-pen-testing local state (issues, scans, logs)";

export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const paths = ohpenPaths(options.cwd);
  const created: string[] = [];
  const skipped: string[] = [];

  await fs.mkdir(paths.root, { recursive: true });
  for (const dir of [
    paths.issues,
    paths.scans,
    paths.reports,
    paths.logs,
    paths.playbooksLocal,
  ]) {
    await fs.mkdir(dir, { recursive: true });
    created.push(path.relative(options.cwd, dir));
  }

  const configExists = await fileExists(paths.config);
  if (configExists && !options.overwrite) {
    skipped.push(path.relative(options.cwd, paths.config));
  } else {
    const projectName = options.projectName ?? (await inferProjectName(options.cwd));
    const languages = options.languages ?? (await inferLanguages(options.cwd));
    const frameworks = await inferFrameworks(options.cwd);
    const repo = await inferGitRepo(options.cwd);
    const preferredProvider = await detectPreferredProvider();
    const defaultConfig = buildDefaultConfig({
      projectName,
      languages,
      frameworks,
      repo,
      preferredProvider,
    });
    if (options.authorisationAcknowledged) {
      defaultConfig.scope.authorisation_acknowledged = true;
      defaultConfig.scope.authorisation_acknowledged_at = new Date().toISOString();
    }
    await writeConfig(options.cwd, defaultConfig);
    created.push(path.relative(options.cwd, paths.config));
  }

  const ohpenIgnoreExists = await fileExists(paths.gitignore);
  if (!ohpenIgnoreExists) {
    await fs.writeFile(paths.gitignore, OHPEN_GITIGNORE, "utf-8");
    created.push(path.relative(options.cwd, paths.gitignore));
  }

  // Add `.ohpentesting/` to the user's ROOT .gitignore so our state
  // dir (issues, scans, logs, config) is never accidentally
  // committed by a buggy `git add .` somewhere — and so `git
  // checkout -f main` (which removes tracked files not present in
  // main) can't sweep our state away as a side effect of switching
  // branches. Without this, an old build that staged `.ohpentesting/`
  // contents into a branch would cause subsequent agent pre-flights
  // to wipe half the state on the next checkout.
  //
  // Idempotent: only appends if the marker isn't already present.
  // We don't touch any other line in the user's .gitignore.
  const rootGitignore = path.join(options.cwd, ".gitignore");
  try {
    const existing = await readFileIfExists(rootGitignore);
    if (!existing) {
      // No .gitignore at all — create one with just our marker.
      await fs.writeFile(
        rootGitignore,
        ROOT_GITIGNORE_MARKER + "\n",
        "utf-8",
      );
      created.push(".gitignore (created with .ohpentesting/ entry)");
    } else if (!existing.includes(".ohpentesting")) {
      // Has one already — append our entry.
      const sep = existing.endsWith("\n") ? "" : "\n";
      await fs.writeFile(
        rootGitignore,
        existing + sep + ROOT_GITIGNORE_MARKER + "\n",
        "utf-8",
      );
      created.push(".gitignore (appended .ohpentesting/ entry)");
    }
  } catch {
    // Best effort — failing to update .gitignore isn't fatal, the
    // pre-flight snapshot/restore is the second line of defence.
  }

  // Install pre-commit hook if this is a git repo
  const gitHooksDir = path.join(options.cwd, ".git", "hooks");
  if (await dirExists(gitHooksDir)) {
    const hookPath = path.join(gitHooksDir, "pre-commit");
    const existing = await readFileIfExists(hookPath);
    if (existing && existing.includes(PRE_COMMIT_HOOK_MARKER)) {
      skipped.push(".git/hooks/pre-commit");
    } else if (existing) {
      const appended = existing.endsWith("\n") ? existing : existing + "\n";
      await fs.writeFile(hookPath, appended + "\n" + PRE_COMMIT_HOOK_BODY, "utf-8");
      await fs.chmod(hookPath, 0o755);
      created.push(".git/hooks/pre-commit (appended)");
    } else {
      await fs.writeFile(hookPath, PRE_COMMIT_HOOK_BODY, "utf-8");
      await fs.chmod(hookPath, 0o755);
      created.push(".git/hooks/pre-commit");
    }
  }

  return { created, skipped, configPath: paths.config };
}

async function fileExists(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function readFileIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

/**
 * Detect the best-available provider to default the config to:
 *  1. `claude` CLI on PATH → claude-code-cli (free on Max, no API key needed)
 *  2. ANTHROPIC_API_KEY in env → claude-api
 *  3. Ollama reachable at localhost:11434 → ollama (free, local)
 *  4. Otherwise → claude-code-cli as a hopeful default (user will be prompted
 *     to install or override).
 */
async function detectPreferredProvider(): Promise<ProviderId> {
  try {
    await exec("claude", ["--version"], { timeout: 3000 });
    return "claude-code-cli";
  } catch {
    // claude CLI not found
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return "claude-api";
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch("http://localhost:11434/api/version", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) return "ollama";
  } catch {
    // ollama not reachable
  }
  return "claude-code-cli";
}

async function inferProjectName(cwd: string): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(cwd, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { name?: string };
    if (pkg.name) return pkg.name;
  } catch {
    // fall through
  }
  return path.basename(cwd);
}

async function inferLanguages(cwd: string): Promise<Language[]> {
  const langs: Language[] = [];
  if (await fileExists(path.join(cwd, "tsconfig.json"))) {
    langs.push("typescript");
  } else if (await fileExists(path.join(cwd, "package.json"))) {
    langs.push("javascript");
  }
  if (
    (await fileExists(path.join(cwd, "pyproject.toml"))) ||
    (await fileExists(path.join(cwd, "requirements.txt"))) ||
    (await fileExists(path.join(cwd, "setup.py")))
  ) {
    langs.push("python");
  }
  return langs.length > 0 ? langs : ["generic"];
}

async function inferFrameworks(cwd: string): Promise<Framework[]> {
  const pkgPath = path.join(cwd, "package.json");
  const raw = await readFileIfExists(pkgPath);
  if (!raw) return [];
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(raw);
  } catch {
    return [];
  }
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const out: Framework[] = [];
  if ("react" in allDeps) out.push("react");
  if ("@angular/core" in allDeps) out.push("angular");
  if ("vue" in allDeps) out.push("vue");
  if ("svelte" in allDeps) out.push("svelte");
  if ("next" in allDeps) out.push("nextjs");
  if ("vite" in allDeps) out.push("vite");
  if ("express" in allDeps) out.push("express");
  return out;
}

async function inferGitRepo(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await exec("git", ["config", "--get", "remote.origin.url"], {
      cwd,
    });
    const url = stdout.trim();
    const match =
      url.match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/) ??
      url.match(/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    // ok — not a git repo or no remote
  }
  return undefined;
}
