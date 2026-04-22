import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface ClaudeCliDetection {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * Common places `claude` lands on macOS / Linux installs. We probe these
 * when the bare `claude` call fails — typical for `next dev` servers
 * launched from IDEs that inherit a minimal PATH.
 */
const COMMON_INSTALL_LOCATIONS = [
  "/opt/homebrew/bin/claude", // Apple Silicon Homebrew
  "/usr/local/bin/claude", // Intel Homebrew / manual installs
  "/usr/bin/claude", // some distro packages
  path.join(os.homedir(), ".local", "bin", "claude"),
  path.join(os.homedir(), ".claude", "local", "claude"),
  path.join(os.homedir(), ".npm-global", "bin", "claude"),
  path.join(os.homedir(), ".bun", "bin", "claude"),
];

async function tryBinary(
  bin: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const { stdout } = await exec(bin, ["--version"], { timeout: 5000 });
    return { ok: true, version: stdout.trim() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Find the claude binary. Tries (1) `claude` on PATH, (2) a list of
 * well-known install locations. Returns the first working absolute path.
 */
export async function findClaudeBin(): Promise<
  { ok: true; bin: string; version: string } | { ok: false; error: string }
> {
  // 1. PATH
  const onPath = await tryBinary("claude");
  if (onPath.ok) {
    return { ok: true, bin: "claude", version: onPath.version ?? "" };
  }
  // 2. Well-known locations
  const tried: string[] = [];
  for (const candidate of COMMON_INSTALL_LOCATIONS) {
    tried.push(candidate);
    if (!fs.existsSync(candidate)) continue;
    const res = await tryBinary(candidate);
    if (res.ok) {
      return { ok: true, bin: candidate, version: res.version ?? "" };
    }
  }
  return {
    ok: false,
    error:
      `'claude' not found. Checked PATH and: ${tried.join(", ")}. ` +
      "Install from https://claude.ai/download or add claude to the PATH of the process running Oh Pen Testing.",
  };
}

/**
 * Probe `claude --version` to detect the CLI. Reports the resolved path
 * so the provider can spawn the correct binary even when PATH is
 * minimal (which `next dev` servers often have).
 */
export async function detectClaudeCliInstalled(): Promise<ClaudeCliDetection> {
  const found = await findClaudeBin();
  if (!found.ok) {
    return { installed: false, error: found.error };
  }
  return {
    installed: true,
    version: found.version,
    path: found.bin,
  };
}

export interface ClaudeCliFlags {
  /** Flag that tells claude to run headless with a prompt. */
  promptFlag: "-p" | "--print";
  /** Flag + value for JSON output. */
  jsonFormat: readonly ["--output-format", "json"];
  /** Flag + value for stream-json output. */
  streamFormat: readonly ["--output-format", "stream-json"];
}

/**
 * Probe `claude --help` to verify which headless flags are available. Falls
 * back to the current documented combination if probing fails.
 */
export async function detectClaudeCliFlags(): Promise<ClaudeCliFlags> {
  const fallback: ClaudeCliFlags = {
    promptFlag: "-p",
    jsonFormat: ["--output-format", "json"],
    streamFormat: ["--output-format", "stream-json"],
  };
  const found = await findClaudeBin();
  if (!found.ok) return fallback;
  try {
    const { stdout } = await exec(found.bin, ["--help"], { timeout: 5000 });
    const help = stdout.toLowerCase();
    if (!help.includes("--output-format")) {
      return fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
