"use server";

import { revalidatePath } from "next/cache";
import { loadConfig } from "@oh-pen-testing/shared";
import {
  resolveProvider,
  runAgent,
  registerProvider,
} from "@oh-pen-testing/core";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import {
  createGitHubAdapter,
  resolveGitHubToken,
} from "@oh-pen-testing/git-github";
import { getOhpenCwd } from "../../../lib/ohpen-cwd";
import { getIssue } from "../../../lib/repo";
import { ensureProvidersRegistered } from "../../../lib/providers-bootstrap";
import path from "node:path";

export async function remediateAction(
  issueId: string,
): Promise<{ prUrl: string; prNumber: number }> {
  ensureProvidersRegistered();
  const cwd = getOhpenCwd();
  const config = await loadConfig(cwd);
  const issue = await getIssue(issueId);
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  if (issue.severity === "critical") {
    throw new Error(
      "Critical issues require the full agent pool (M4). Use the CLI for now.",
    );
  }
  const provider = await resolveProvider({ config });
  const token = await resolveGitHubToken();
  if (!token) throw new Error("No GITHUB_TOKEN found.");
  const adapter = createGitHubAdapter({
    token,
    repo: config.git.repo,
    defaultBranch: config.git.default_branch,
  });
  const result = await runAgent({
    issueId,
    cwd,
    config,
    provider,
    adapter,
    playbookRoots: [
      BUNDLED_PLAYBOOKS_DIR,
      path.join(cwd, ".ohpentesting", "playbooks", "local"),
    ],
  });
  revalidatePath(`/issue/${issueId}`);
  revalidatePath("/board");
  return { prUrl: result.prUrl, prNumber: result.prNumber };
}
