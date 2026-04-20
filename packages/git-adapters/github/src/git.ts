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

export async function push(repoPath: string, branchName: string): Promise<void> {
  const git = openRepo(repoPath);
  await git.push("origin", branchName, ["--set-upstream"]);
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const git = openRepo(repoPath);
  const status = await git.status();
  return status.current ?? "main";
}
