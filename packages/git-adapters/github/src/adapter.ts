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

export async function resolveGitHubToken(): Promise<string | null> {
  const fromEnv = process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    // keytar is optional. Loaded via an indirect dynamic import so DTS
    // generation doesn't try to resolve the module.
    const dynamicImport = new Function(
      "m",
      "return import(m)",
    ) as (m: string) => Promise<{
      default: { getPassword(service: string, account: string): Promise<string | null> };
    }>;
    const mod = await dynamicImport("keytar");
    const fromKeychain = await mod.default.getPassword(
      "oh-pen-testing",
      KEYTAR_ACCOUNT_GITHUB,
    );
    return fromKeychain ?? null;
  } catch {
    return null;
  }
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
