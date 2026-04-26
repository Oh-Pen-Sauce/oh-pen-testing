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

export async function commitAll(
  repoPath: string,
  message: string,
  author: GitAuthor = MARINARA_AUTHOR,
): Promise<string> {
  const git = openRepo(repoPath);
  await git.add(".");
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
 */
export async function resetToCleanBranch(
  repoPath: string,
  branch: string,
): Promise<void> {
  const git = openRepo(repoPath);
  await git.checkout(["-f", branch]);
  await git.clean("f", ["-d"]);
}
