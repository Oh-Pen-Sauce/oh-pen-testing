"use server";

import { revalidatePath } from "next/cache";
import { loadConfig, writeIssue } from "@oh-pen-testing/shared";
import {
  resolveProvider,
  runAgent,
  runVerify,
} from "@oh-pen-testing/core";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import {
  createGitHubAdapter,
  resolveGitHubToken,
} from "@oh-pen-testing/git-github";
import { resolveScanTargetPath } from "../../../lib/ohpen-cwd";
import { getIssue } from "../../../lib/repo";
import { ensureProvidersRegistered } from "../../../lib/providers-bootstrap";
import path from "node:path";

/**
 * Standard remediation — runs the autonomy gate. If the issue
 * triggers approval (recommended+critical, careful, or any
 * approval_trigger match), the agent leaves it in pending_approval
 * and throws AgentApprovalRequired, which the UI surfaces as
 * "needs approval — click Approve & open PR".
 */
export async function remediateAction(
  issueId: string,
): Promise<{ prUrl: string; prNumber: number }> {
  return remediateInternal(issueId, false);
}

/**
 * One-click "Approve & open PR" — bypasses the autonomy gate
 * because the human just clicked the green button. Use this when
 * the user is explicitly approving a `pending_approval` issue. Adds
 * an audit comment so the trail of "human approved this" is visible
 * on the issue.
 */
export async function approveAndRemediateAction(
  issueId: string,
): Promise<{ prUrl: string; prNumber: number }> {
  ensureProvidersRegistered();
  const cwd = await resolveScanTargetPath();
  const issue = await getIssue(issueId);
  if (!issue) throw new Error(`Issue ${issueId} not found`);

  // Audit trail: explicit human approval recorded on the issue
  // before we touch any code. If the agent crashes, we still have
  // the approval marker.
  issue.comments.push({
    author: "web-reviewer",
    text: "Approved for agent remediation via the web UI — autonomy gate bypassed for this run.",
    at: new Date().toISOString(),
  });
  // If status was pending_approval, transition to ready first so
  // the issue's state matches "human approved, agent is going".
  if (issue.status === "pending_approval") {
    issue.status = "ready";
  }
  await writeIssue(cwd, issue);

  return remediateInternal(issueId, true);
}

async function remediateInternal(
  issueId: string,
  bypassAutonomyGate: boolean,
): Promise<{ prUrl: string; prNumber: number }> {
  ensureProvidersRegistered();
  const cwd = await resolveScanTargetPath();
  const config = await loadConfig(cwd);
  const issue = await getIssue(issueId);
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  // Critical-severity gate is a UI-side guardrail to keep the
  // synchronous web path off truly dangerous changes. Use the CLI
  // (which can attach a logger and run async) for those.
  if (issue.severity === "critical" && !bypassAutonomyGate) {
    throw new Error(
      "Critical issues require approval — use the green 'Approve & open PR' button.",
    );
  }
  const provider = await resolveProvider({ config });
  const token = await resolveGitHubToken();
  if (!token) {
    throw new Error(
      "No GitHub token found. Finish the wizard's GitHub step (or export GITHUB_TOKEN) so PRs can actually be opened.",
    );
  }
  if (!config.git.repo || config.git.repo === "owner/name") {
    throw new Error(
      "PR target repo not set. Finish the GitHub step in /setup so I know where to open PRs.",
    );
  }
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
    bypassAutonomyGate,
  });
  revalidatePath(`/issue/${issueId}`);
  revalidatePath("/board");
  revalidatePath("/reviews");
  return { prUrl: result.prUrl, prNumber: result.prNumber };
}

export async function verifyAction(
  issueId: string,
): Promise<{ verified: boolean; hitsRemaining: number }> {
  ensureProvidersRegistered();
  const cwd = await resolveScanTargetPath();
  const config = await loadConfig(cwd);
  const provider = await resolveProvider({ config });
  const result = await runVerify({
    cwd,
    config,
    issueId,
    provider,
    playbookRoots: [
      BUNDLED_PLAYBOOKS_DIR,
      path.join(cwd, ".ohpentesting", "playbooks", "local"),
    ],
  });
  revalidatePath(`/issue/${issueId}`);
  revalidatePath("/board");
  return {
    verified: result.verified,
    hitsRemaining: result.hitsRemaining,
  };
}
