import fs from "node:fs/promises";
import nodePath from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";

export interface GitAuthor {
  name: string;
  email: string;
}

export const MARINARA_AUTHOR: GitAuthor = {
  name: "Marinara",
  email: "marinara@oh-pen-testing.local",
};

export function openRepo(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export async function createBranch(
  repoPath: string,
  branchName: string,
  baseBranch?: string,
): Promise<void> {
  const git = openRepo(repoPath);
  if (baseBranch) {
    await git.checkoutBranch(branchName, baseBranch);
  } else {
    await git.checkoutLocalBranch(branchName);
  }
}

/**
 * Stage and commit. If `files` is provided, ONLY those paths are
 * staged — critical for avoiding accidental inclusion of
 * Oh Pen Testing's own state directory (`.ohpentesting/`) in
 * remediation PRs. Without an explicit list, `git add .` would
 * pick up issue JSON files, scan logs, and the counter alongside
 * the actual security fix, and the resulting PR diff would be
 * dominated by tool-internal noise.
 *
 * Falls back to `git add .` when files isn't provided, for
 * back-compat with any callers that don't yet thread the list
 * through (none currently in tree, but keeping the door open).
 */
export async function commitAll(
  repoPath: string,
  message: string,
  author: GitAuthor = MARINARA_AUTHOR,
  files?: string[],
): Promise<string> {
  const git = openRepo(repoPath);
  if (files && files.length > 0) {
    await git.add(files);
  } else {
    await git.add(".");
  }
  const result = await git.commit(message, undefined, {
    "--author": `${author.name} <${author.email}>`,
  });
  return result.commit;
}

/**
 * Push a branch. By default uses `origin` (whatever credentials git
 * has configured locally — SSH key, credential helper, or none). If
 * `pushUrl` is passed, push to THAT URL instead — this is how the
 * GitHub adapter injects the API token into the URL for HTTPS push
 * auth without depending on the user's local git credentials.
 *
 * The pushUrl variant is strictly safer than mutating origin's URL,
 * because (a) it doesn't leave a token-laden remote URL on disk
 * after the operation, and (b) it doesn't conflict with whatever
 * other tools might be reading origin.
 */
export async function push(
  repoPath: string,
  branchName: string,
  options: { pushUrl?: string } = {},
): Promise<void> {
  const git = openRepo(repoPath);
  const remote = options.pushUrl ?? "origin";
  await git.push(remote, branchName, ["--set-upstream"]);
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const git = openRepo(repoPath);
  const status = await git.status();
  return status.current ?? "main";
}

/**
 * Force-checkout `branch`, then remove untracked files. The
 * filesystem ends up at exactly `branch`'s state, regardless of
 * what was there before — pending edits, leftover branches with
 * uncommitted state, untracked clutter from prior failed runs.
 *
 * Used as a pre-flight before each agent run so each remediation
 * starts from a known-clean baseline. DESTRUCTIVE: any uncommitted
 * work in the working tree is lost. Only safe to use against repos
 * where the user shouldn't be editing manually (e.g. a clone Oh
 * Pen Testing manages under ~/.ohpentesting/projects/).
 *
 * **Snapshots and restores `.ohpentesting/` around the checkout.**
 * Why both layers (excluding it from `git clean` AND
 * snapshot/restore around `git checkout -f`)?
 *
 *   - `git clean -fd` removes untracked files. We exclude
 *     .ohpentesting/ via -e so our state survives.
 *   - `git checkout -f main` removes TRACKED files that exist on
 *     the previous branch but not on main. If a buggy old build
 *     (or a manual `git add .`) ever staged .ohpentesting/ files
 *     into a branch, switching back to main would wipe them. The
 *     snapshot+restore protects against that — we copy
 *     .ohpentesting/ to memory before checkout, then write it
 *     back after, so even if checkout removes the tree from disk
 *     we've got a backup.
 *
 * Belt-and-suspenders. The .gitignore-based prevention (scaffold
 * adds .ohpentesting/ to the user's root .gitignore) is the
 * primary defence; this is the safety net for repos that haven't
 * been re-scaffolded yet, or where some side channel slipped
 * tracked files in.
 */
export async function resetToCleanBranch(
  repoPath: string,
  branch: string,
): Promise<void> {
  const git = openRepo(repoPath);
  const ohpenSnapshot = await snapshotOhpenDir(repoPath);
  await git.checkout(["-f", branch]);
  await restoreOhpenSnapshot(repoPath, ohpenSnapshot);
  await git.clean("f", [
    "-d",
    "-e",
    ".ohpentesting/",
    "-e",
    ".ohpentesting",
  ]);
}

/**
 * Recursively read every file under .ohpentesting/ into memory as
 * a path → bytes map. Returns an empty map if the dir doesn't
 * exist. Best-effort: any file we can't read (permission, race) is
 * silently skipped.
 */
async function snapshotOhpenDir(
  repoPath: string,
): Promise<Map<string, Buffer>> {
  const snapshot = new Map<string, Buffer>();
  const root = nodePath.join(repoPath, ".ohpentesting");
  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const rel = nodePath.relative(repoPath, full);
          snapshot.set(rel, await fs.readFile(full));
        } catch {
          /* skip unreadable */
        }
      }
    }
  }
  await walk(root);
  return snapshot;
}

/**
 * Write the snapshot back to disk. Creates parent dirs as needed.
 * Only writes files that AREN'T already present on disk with the
 * same byte length — minor optimisation to avoid touching files
 * that survived the checkout, which keeps mtime stable for any
 * tools watching them.
 */
async function restoreOhpenSnapshot(
  repoPath: string,
  snapshot: Map<string, Buffer>,
): Promise<void> {
  for (const [rel, contents] of snapshot.entries()) {
    const full = nodePath.join(repoPath, rel);
    try {
      const existing = await fs.stat(full);
      if (existing.isFile() && existing.size === contents.length) {
        // Same byte count — most likely identical, skip.
        continue;
      }
    } catch {
      /* file doesn't exist — proceed to write */
    }
    try {
      await fs.mkdir(nodePath.dirname(full), { recursive: true });
      await fs.writeFile(full, contents);
    } catch {
      /* skip individual write failures */
    }
  }
}
