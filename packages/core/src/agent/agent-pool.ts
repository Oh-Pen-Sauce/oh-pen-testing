import {
  type AIProvider,
  type Config,
  type Issue,
  type Logger,
  createNoopLogger,
  listIssues,
} from "@oh-pen-testing/shared";
import {
  AGENT_IDS,
  KNOWN_AGENTS,
  pickAgentForPlaybook,
  type AgentIdentity,
} from "./agents.js";
import {
  AgentApprovalRequired,
  runAgent,
  type RemediationAdapter,
  type RunAgentResult,
} from "./run-agent.js";

export interface AgentPoolOptions {
  cwd: string;
  config: Config;
  provider: AIProvider;
  adapter: RemediationAdapter;
  playbookRoots: string[];
  logger?: Logger;
  /** Optional filter — only process issues passing this predicate. */
  filter?: (issue: Issue) => boolean;
  /** Override parallelism from config. */
  parallelism?: number;
  /** Progress callback for CLI/UI. */
  onProgress?: (event: AgentPoolProgressEvent) => void;
}

export type AgentPoolProgressEvent =
  | { type: "assigned"; agent: string; issueId: string }
  | { type: "completed"; agent: string; issueId: string; prUrl: string }
  | { type: "gated"; agent: string; issueId: string; reason: string }
  | { type: "failed"; agent: string; issueId: string; error: string };

export interface AgentPoolResult {
  completed: RunAgentResult[];
  gated: Array<{ issueId: string; agentId: string; reason: string }>;
  failed: Array<{ issueId: string; agentId: string; error: string }>;
}

/**
 * Work-stealing agent pool.
 *
 * Initial assignment: each open issue is bucketed to the agent whose specialty
 * best matches its playbook. Each agent then concurrently drains its own
 * bucket. When an agent finishes its bucket and the overall queue still has
 * work, it steals the first unclaimed issue from any other bucket.
 *
 * Parallelism is capped by `config.agents.parallelism` (default 4). Running
 * more than 4 simultaneously rarely helps because AI calls serialise at the
 * provider's rate-limit anyway.
 *
 * Autonomy-mode gating happens inside runAgent — gated issues surface as
 * AgentApprovalRequired; the pool catches them and moves on.
 */
export async function runAgentPool(
  options: AgentPoolOptions,
): Promise<AgentPoolResult> {
  const logger = options.logger ?? createNoopLogger();
  const parallelism =
    options.parallelism ?? Math.min(options.config.agents.parallelism, AGENT_IDS.length);

  const allIssues = await listIssues(options.cwd);
  const eligible = allIssues.filter((i) => {
    if (i.status !== "backlog" && i.status !== "ready") return false;
    if (options.filter && !options.filter(i)) return false;
    return true;
  });

  logger.info("pool.start", {
    total: eligible.length,
    parallelism,
    autonomy: options.config.agents.autonomy,
  });

  // Initial bucket assignment — deterministic per-issue so reruns are stable.
  const buckets: Map<string, Issue[]> = new Map(AGENT_IDS.map((id) => [id, []]));
  for (const issue of eligible) {
    const preferred = pickAgentForPlaybook(
      issue.remediation?.strategy ?? "",
      issue.owasp_category,
    );
    buckets.get(preferred.id)!.push(issue);
  }

  // Shared queue of "anything still pending" — used for work-stealing after an
  // agent finishes its bucket. Seeded with all eligible issues in priority
  // order (critical first) so stealers pick up the most important work.
  const stealPile: Issue[] = [...eligible].sort(severitySort);

  const taken = new Set<string>();
  const completed: RunAgentResult[] = [];
  const gated: AgentPoolResult["gated"] = [];
  const failed: AgentPoolResult["failed"] = [];

  async function tryIssue(agent: AgentIdentity, issue: Issue): Promise<void> {
    if (taken.has(issue.id)) return;
    taken.add(issue.id);
    options.onProgress?.({
      type: "assigned",
      agent: agent.id,
      issueId: issue.id,
    });
    try {
      const result = await runAgent({
        issueId: issue.id,
        agentId: agent.id,
        cwd: options.cwd,
        config: options.config,
        provider: options.provider,
        adapter: options.adapter,
        playbookRoots: options.playbookRoots,
        logger,
      });
      completed.push(result);
      options.onProgress?.({
        type: "completed",
        agent: agent.id,
        issueId: issue.id,
        prUrl: result.prUrl,
      });
    } catch (err) {
      if (err instanceof AgentApprovalRequired) {
        gated.push({
          issueId: issue.id,
          agentId: agent.id,
          reason: err.reason,
        });
        options.onProgress?.({
          type: "gated",
          agent: agent.id,
          issueId: issue.id,
          reason: err.reason,
        });
      } else {
        failed.push({
          issueId: issue.id,
          agentId: agent.id,
          error: (err as Error).message,
        });
        options.onProgress?.({
          type: "failed",
          agent: agent.id,
          issueId: issue.id,
          error: (err as Error).message,
        });
      }
    }
  }

  async function drain(agent: AgentIdentity, ownBucket: Issue[]): Promise<void> {
    // Drain own bucket first, then steal.
    for (const issue of ownBucket) {
      if (taken.has(issue.id)) continue;
      await tryIssue(agent, issue);
    }
    // Work-stealing loop.
    while (true) {
      const idx = stealPile.findIndex((i) => !taken.has(i.id));
      if (idx === -1) break;
      const issue = stealPile[idx]!;
      await tryIssue(agent, issue);
    }
  }

  // Only spawn up to `parallelism` agents. Extras don't exist yet.
  const activeAgents = AGENT_IDS.slice(0, parallelism)
    .map((id) => KNOWN_AGENTS[id]!)
    .filter(Boolean);

  await Promise.all(
    activeAgents.map((agent) => drain(agent, buckets.get(agent.id) ?? [])),
  );

  logger.info("pool.complete", {
    completed: completed.length,
    gated: gated.length,
    failed: failed.length,
  });

  return { completed, gated, failed };
}

function severityRank(s: string): number {
  return (
    { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as Record<string, number>
  )[s] ?? 5;
}

function severitySort(a: Issue, b: Issue): number {
  return severityRank(a.severity) - severityRank(b.severity);
}

/**
 * Approve a previously-gated issue so the agent can proceed on the next run.
 * Transitions status pending_approval → ready and clears the gated-reason
 * marker (written by runAgent).
 */
export async function approveGatedIssue(
  cwd: string,
  issueId: string,
  approver?: string,
): Promise<Issue> {
  const { readIssue, writeIssue } = await import("@oh-pen-testing/shared");
  const issue = await readIssue(cwd, issueId);
  if (issue.status !== "pending_approval") {
    throw new Error(
      `ISSUE-${issueId} is not pending approval (status=${issue.status})`,
    );
  }
  issue.status = "ready";
  issue.comments.push({
    author: approver ?? "human",
    text: "Approved for agent remediation.",
    at: new Date().toISOString(),
  });
  await writeIssue(cwd, issue);
  return issue;
}
