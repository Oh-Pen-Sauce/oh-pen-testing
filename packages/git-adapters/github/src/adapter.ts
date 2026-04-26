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
      // Each step gets a labelled try/catch so when something fails
      // the user sees "git push failed: 403 Forbidden" rather than
      // a bare "403 Forbidden" with no idea which of the four
      // sub-operations exploded. Critical for debugging — the four
      // steps fail for very different reasons.
      let baseBranch: string;
      try {
        baseBranch = await getCurrentBranch(input.repoPath);
      } catch (err) {
        throw new Error(
          `[step: read current branch] ${(err as Error).message} — is ${input.repoPath} a git repo?`,
        );
      }

      try {
        await createBranch(input.repoPath, input.branchName, baseBranch);
      } catch (err) {
        throw new Error(
          `[step: create branch '${input.branchName}'] ${(err as Error).message} — branch may already exist from a prior failed run, or the working tree may be dirty.`,
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
          `[step: commit] ${(err as Error).message} — most often the agent's patch was identical to the existing file, so there's nothing to commit.`,
        );
      }

      try {
        await push(input.repoPath, input.branchName);
      } catch (err) {
        throw new Error(
          `[step: git push] ${(err as Error).message} — likely the local clone has no push credentials. The GitHub token configured in oh-pen-testing is used for the API call, NOT for git push. Set up an SSH key for the clone, or use a credential helper that injects the token.`,
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
          `[step: open PR via GitHub API] ${(err as Error).message} — the token may lack 'pull-requests: write' permission, or the base branch '${defaultBranch}' may not exist on the remote.`,
        );
      }
    },
  };
}
