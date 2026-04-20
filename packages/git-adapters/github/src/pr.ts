import { Octokit } from "@octokit/rest";

export interface OpenPullRequestInput {
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body: string;
  labels?: string[];
  token: string;
}

export interface PullRequestResult {
  number: number;
  url: string;
  nodeId: string;
}

export async function openPullRequest(
  input: OpenPullRequestInput,
): Promise<PullRequestResult> {
  const octokit = new Octokit({ auth: input.token });
  const pr = await octokit.pulls.create({
    owner: input.owner,
    repo: input.repo,
    head: input.head,
    base: input.base,
    title: input.title,
    body: input.body,
  });
  if (input.labels && input.labels.length > 0) {
    await octokit.issues.addLabels({
      owner: input.owner,
      repo: input.repo,
      issue_number: pr.data.number,
      labels: input.labels,
    });
  }
  return {
    number: pr.data.number,
    url: pr.data.html_url,
    nodeId: pr.data.node_id,
  };
}

export function parseGitHubRepo(repo: string): { owner: string; repo: string } {
  const match = repo.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!match) {
    throw new Error(`Invalid GitHub repo: ${repo}. Expected "owner/name".`);
  }
  return { owner: match[1]!, repo: match[2]! };
}
