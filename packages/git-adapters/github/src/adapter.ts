import {
  commitAll,
  createBranch,
  push,
  type GitAuthor,
  MARINARA_AUTHOR,
} from "./git.js";
import { openPullRequest, parseGitHubRepo, type PullRequestResult } from "./pr.js";
import { buildPrBody, type PrBodyInput } from "./templates/pr-body.js";

export interface GitHubAdapterOptions {
  token: string;
  /** owner/name, e.g. "Oh-Pen-Sauce/oh-pen-testing" */
  repo: string;
  defaultBranch?: string;
}

export interface RemediationPushInput {
  repoPath: string;
  branchName: string;
  commitMessage: string;
  author?: GitAuthor;
  prTitle: string;
  prBody: PrBodyInput;
  labels?: string[];
}

export interface GitHubAdapter {
  /**
   * Create a branch, commit all current staged/unstaged changes, push it,
   * and open a PR. Returns the PR result.
   */
  createRemediationPr(input: RemediationPushInput): Promise<PullRequestResult>;
}

export const KEYTAR_ACCOUNT_GITHUB = "github-token";

/**
 * Walks GITHUB_TOKEN env → OS keychain → ~/.ohpentesting/secrets.json
 * via the shared secrets store. Same three-tier logic everywhere so
 * users never have to know which tier their token ended up in.
 */
export async function resolveGitHubToken(): Promise<string | null> {
  const { getSecret } = await import("@oh-pen-testing/shared");
  const result = await getSecret(KEYTAR_ACCOUNT_GITHUB);
  return result.value;
}

/**
 * Strip the GitHub API token out of an error message so the user
 * never sees it in the UI or logs. The token gets embedded in the
 * push URL (https://x-access-token:TOKEN@github.com/...) and any
 * git error that mentions the URL would otherwise leak it. We
 * redact every `x-access-token:something@` occurrence on its way
 * out of the adapter.
 */
function redactToken(input: string): string {
  return input.replace(
    /x-access-token:[^@\s]+@/gi,
    "x-access-token:***@",
  );
}

export function createGitHubAdapter(
  options: GitHubAdapterOptions,
): GitHubAdapter {
  const { owner, repo } = parseGitHubRepo(options.repo);
  const defaultBranch = options.defaultBranch ?? "main";

  // Authenticated push URL using the token. Important: the API
  // token lets us hit the REST API for opening PRs but says NOTHING
  // about whether the local clone has push credentials — most users
  // clone via HTTPS without auth and `git push origin` then fails
  // with "Repository not found" (GitHub's same-error-for-no-access-
  // and-not-found policy). Pushing to this URL instead uses the
  // token for auth directly, so the API and push share one
  // credential path. The user only has to set up the token once.
  //
  // GitHub's documented bot-token format is `x-access-token:<TOKEN>`.
  // Standard PATs (classic + fine-grained) work the same way.
  const pushUrl = `https://x-access-token:${options.token}@github.com/${owner}/${repo}.git`;

  return {
    async createRemediationPr(input: RemediationPushInput) {
      // Each step gets a labelled try/catch so when something fails
      // the user sees "git push failed: 403 Forbidden" rather than
      // a bare "403 Forbidden" with no idea which of the four
      // sub-operations exploded. Critical for debugging — the four
      // steps fail for very different reasons.

      // Branch from the configured default branch (e.g. main), NOT
      // from whatever's currently checked out. This is critical for
      // sequential remediation runs: previous agents leave HEAD on
      // their own remediation branches, and basing a new branch off
      // that cascades — Agent 2's branch contains Agent 1's commit,
      // Agent 3's contains 1+2, etc. By the time Agent N opens its
      // PR, the diff against main is N commits long. We saw this in
      // production as 30 commits in one PR (pull/68 in the user's
      // repo). Always branching from defaultBranch keeps each PR a
      // 1-commit isolated diff.
      try {
        await createBranch(input.repoPath, input.branchName, defaultBranch);
      } catch (err) {
        throw new Error(
          `[step: create branch '${input.branchName}' from ${defaultBranch}] ${redactToken((err as Error).message)} — possible causes: (a) ${input.repoPath} isn't a git repo, (b) ${defaultBranch} doesn't exist locally (try \`git fetch origin\`), (c) branch already exists from a prior failed run (delete it locally + on the remote), (d) working tree has uncommitted changes that conflict with ${defaultBranch}.`,
        );
      }

      try {
        await commitAll(
          input.repoPath,
          input.commitMessage,
          input.author ?? MARINARA_AUTHOR,
        );
      } catch (err) {
        throw new Error(
          `[step: commit] ${redactToken((err as Error).message)} — most often the agent's patch was identical to the existing file, so there's nothing to commit.`,
        );
      }

      try {
        // Push using the token-authenticated URL — bypasses the
        // user's local git credential setup entirely. See pushUrl
        // construction above.
        await push(input.repoPath, input.branchName, { pushUrl });
      } catch (err) {
        throw new Error(
          `[step: git push] ${redactToken((err as Error).message)} — token-authenticated push failed. Common causes: the token doesn't have 'Contents: write' permission on this repo, or the repo slug (${options.repo}) is wrong.`,
        );
      }

      try {
        return await openPullRequest({
          owner,
          repo,
          head: input.branchName,
          base: defaultBranch,
          title: input.prTitle,
          body: buildPrBody(input.prBody),
          labels: input.labels,
          token: options.token,
        });
      } catch (err) {
        throw new Error(
          `[step: open PR via GitHub API] ${redactToken((err as Error).message)} — the token may lack 'pull-requests: write' permission, or the base branch '${defaultBranch}' may not exist on the remote.`,
        );
      }
    },
  };
}
