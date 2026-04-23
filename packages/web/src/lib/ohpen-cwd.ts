import { getActiveProjectPath } from "@oh-pen-testing/shared";

/**
 * Legacy "where's the scan target?" helper. Returns OHPEN_CWD or
 * process.cwd() — does NOT check the managed-projects registry.
 *
 * Kept for backward compatibility with internal code that needs a
 * sync answer. For anything scan-critical (the scanner itself, the
 * banner, the setup assistant), use `resolveScanTargetPath()` which
 * honours the active project.
 */
export function getOhpenCwd(): string {
  return process.env.OHPEN_CWD ?? process.cwd();
}

/**
 * The full scan-target resolver — checks the managed-projects
 * registry first, then falls back to cwd.
 *
 * Priority:
 *   1. Active managed project's localPath (from
 *      ~/.ohpentesting/projects.json), if one is marked active.
 *      This is the "install once, point at many GitHub repos" mode.
 *   2. OHPEN_CWD environment variable (explicit override — used by
 *      CLI wrappers and Docker).
 *   3. process.cwd() — legacy "launched from inside the repo" mode.
 */
export async function resolveScanTargetPath(): Promise<string> {
  const active = await getActiveProjectPath();
  if (active) return active;
  return process.env.OHPEN_CWD ?? process.cwd();
}
