"use server";

import { revalidatePath } from "next/cache";
import {
  loadConfig,
  type Issue,
} from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import { resolveProvider, runAgentPool } from "@oh-pen-testing/core";
import {
  createGitHubAdapter,
  resolveGitHubToken,
} from "@oh-pen-testing/git-github";
import { resolveScanTargetPath } from "../../lib/ohpen-cwd";
import { ensureProvidersRegistered } from "../../lib/providers-bootstrap";

export interface AutoRemediateResult {
  ok: boolean;
  detail: string;
  /** PR URLs opened by the pool (one per remediated issue). */
  prUrls: string[];
  /** Issues that were gated for approval (not PR'd yet). */
  gated: Array<{ issueId: string; reason: string }>;
  /** Issues that failed for any reason — network, provider, conflict. */
  failed: Array<{ issueId: string; error: string }>;
  autonomy: string;
}

/**
 * Fires the work-stealing agent pool at every backlog/ready issue
 * currently on the board. Intended to be called right after a scan
 * completes, when the user is in YOLO / full-YOLO and wants the
 * agents to "just go".
 *
 * This is a blocking request-response — it returns once the pool
 * drains OR any serious failure halts it. For large issue sets the
 * caller will see a long spinner; the UI shows the cooking
 * animation + a "running…" label so it doesn't look frozen.
 *
 * Autonomy-mode gating happens INSIDE the agent — so in
 * "recommended" / "careful" modes the pool legitimately refuses
 * most issues (AgentApprovalRequired → bucketed to `gated`). The
 * UI should only surface this action when autonomy is permissive
 * enough to make it worthwhile.
 */
export async function runAutoRemediateAction(
  options: {
    /** Only remediate issues at or above this severity. Default "low". */
    minSeverity?: "info" | "low" | "medium" | "high" | "critical";
  } = {},
): Promise<AutoRemediateResult> {
  ensureProvidersRegistered();
  const cwd = await resolveScanTargetPath();
  const config = await loadConfig(cwd);

  // No GitHub token → no PRs can be opened. Surface a clean error
  // instead of letting the agent pool die on its first fetch.
  const token = await resolveGitHubToken();
  if (!token) {
    return {
      ok: false,
      detail:
        "No GitHub token found. Complete the wizard's GitHub step, or export GITHUB_TOKEN in the shell before launching Oh Pen Testing.",
      prUrls: [],
      gated: [],
      failed: [],
      autonomy: config.agents.autonomy,
    };
  }
  if (!config.git.repo || config.git.repo === "owner/name") {
    return {
      ok: false,
      detail:
        "No PR target set. Finish the setup wizard (the GitHub step) so I know where to open PRs.",
      prUrls: [],
      gated: [],
      failed: [],
      autonomy: config.agents.autonomy,
    };
  }

  const provider = await resolveProvider({ config });
  const adapter = createGitHubAdapter({
    token,
    repo: config.git.repo,
    defaultBranch: config.git.default_branch,
  });

  const SEVERITY_ORDER: Record<string, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  const minRank = SEVERITY_ORDER[options.minSeverity ?? "low"] ?? 1;

  const result = await runAgentPool({
    cwd,
    config,
    provider,
    adapter,
    playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
    filter: (issue: Issue) =>
      (SEVERITY_ORDER[issue.severity] ?? 0) >= minRank,
  });

  revalidatePath("/board");
  revalidatePath("/reviews");
  revalidatePath("/scans");
  revalidatePath("/");

  const prUrls = result.completed
    .map((c) => c.prUrl)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  const completedCount = result.completed.length;
  const gatedCount = result.gated.length;
  const failedCount = result.failed.length;

  return {
    ok: true,
    detail:
      completedCount > 0
        ? `${completedCount} PR${completedCount === 1 ? "" : "s"} opened.` +
          (gatedCount > 0
            ? ` ${gatedCount} gated for review.`
            : "") +
          (failedCount > 0 ? ` ${failedCount} failed.` : "")
        : gatedCount > 0
          ? `All ${gatedCount} issue${gatedCount === 1 ? "" : "s"} need approval — your autonomy mode gated them. Check /reviews.`
          : "No issues were eligible for auto-remediation.",
    prUrls,
    gated: result.gated.map((g) => ({
      issueId: g.issueId,
      reason: g.reason,
    })),
    failed: result.failed.map((f) => ({
      issueId: f.issueId,
      error: f.error,
    })),
    autonomy: config.agents.autonomy,
  };
}
