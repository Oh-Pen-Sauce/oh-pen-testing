import {
  commitAll,
  createBranch,
  getCurrentBranch,
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

export function createGitHubAdapter(
  options: GitHubAdapterOptions,
): GitHubAdapter {
  const { owner, repo } = parseGitHubRepo(options.repo);
  const defaultBranch = options.defaultBranch ?? "main";

  return {
    async createRemediationPr(input: RemediationPushInput) {
      const baseBranch = await getCurrentBranch(input.repoPath);
      await createBranch(input.repoPath, input.branchName, baseBranch);
      await commitAll(
        input.repoPath,
        input.commitMessage,
        input.author ?? MARINARA_AUTHOR,
      );
      await push(input.repoPath, input.branchName);
      return openPullRequest({
        owner,
        repo,
        head: input.branchName,
        base: defaultBranch,
        title: input.prTitle,
        body: buildPrBody(input.prBody),
        labels: input.labels,
        token: options.token,
      });
    },
  };
}
