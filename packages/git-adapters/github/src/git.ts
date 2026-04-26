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
 * **Critically excludes `.ohpentesting/`** from the clean. That
 * directory holds Oh Pen Testing's own state — issues, scans,
 * logs, the ID counter — and wiping it during a remediation run
 * causes a catastrophic ENOENT cascade: the agent pool reads N
 * issues from disk before kicking individual agents, and every
 * agent that runs after the first one tries to re-read its issue
 * file and finds it gone. Bare `git clean -fd` doesn't touch
 * gitignored content, but `.ohpentesting/` usually isn't in the
 * user's root `.gitignore` (we never added it to theirs — we only
 * write a gitignore INSIDE the dir, which doesn't help). So we
 * have to be explicit.
 */
export async function resetToCleanBranch(
  repoPath: string,
  branch: string,
): Promise<void> {
  const git = openRepo(repoPath);
  await git.checkout(["-f", branch]);
  await git.clean("f", [
    "-d",
    "-e",
    ".ohpentesting/",
    "-e",
    ".ohpentesting",
  ]);
}
