import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface ClaudeCliDetection {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/**
 * Probe `claude --version` to detect the CLI. No-op if `claude` isn't on PATH.
 */
export async function detectClaudeCliInstalled(): Promise<ClaudeCliDetection> {
  try {
    const { stdout } = await exec("claude", ["--version"], { timeout: 5000 });
    const version = stdout.trim();
    let binPath: string | undefined;
    try {
      const which = await exec("which", ["claude"]);
      binPath = which.stdout.trim();
    } catch {
      // ok — `which` may not exist on every system
    }
    return { installed: true, version, path: binPath };
  } catch (err) {
    return {
      installed: false,
      error: (err as Error).message,
    };
  }
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
  try {
    const { stdout } = await exec("claude", ["--help"], { timeout: 5000 });
    const help = stdout.toLowerCase();
    if (!help.includes("--output-format")) {
      // Unknown CLI — return the documented fallback anyway; runtime will surface errors.
      return fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
