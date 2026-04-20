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
} from "@oh-pen-testing/shared";

const exec = promisify(execFile);

export interface ScaffoldOptions {
  cwd: string;
  overwrite?: boolean;
  projectName?: string;
  languages?: Language[];
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
    const defaultConfig = buildDefaultConfig({
      projectName,
      languages,
      frameworks,
      repo,
    });
    await writeConfig(options.cwd, defaultConfig);
    created.push(path.relative(options.cwd, paths.config));
  }

  const ohpenIgnoreExists = await fileExists(paths.gitignore);
  if (!ohpenIgnoreExists) {
    await fs.writeFile(paths.gitignore, OHPEN_GITIGNORE, "utf-8");
    created.push(path.relative(options.cwd, paths.gitignore));
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
