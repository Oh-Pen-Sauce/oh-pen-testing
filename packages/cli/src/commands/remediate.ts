import type { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import {
  resolveProvider,
  runAgent,
  runAgentPool,
  AgentApprovalRequired,
} from "@oh-pen-testing/core";
import {
  createGitHubAdapter,
  resolveGitHubToken,
} from "@oh-pen-testing/git-github";
import {
  resolveLocalPlaybooksRoot,
  resolveRemotePlaybooksRoot,
} from "../util/playbook-paths.js";

export function registerRemediate(program: Command): void {
  program
    .command("remediate")
    .description("Have agents fix issue(s) and open PRs")
    .option("-i, --issue <id>", "Single issue ID, e.g. ISSUE-001")
    .option("-a, --agent <name>", "Agent ID override (single-issue mode only)")
    .option("--all", "Remediate every backlog/ready issue via the agent pool")
    .option(
      "--severity <level>",
      "When --all is set, only remediate issues at or above this severity (info|low|medium|high|critical)",
    )
    .action(
      async (
        opts: {
          issue?: string;
          agent?: string;
          all?: boolean;
          severity?: string;
        },
        cmd,
      ) => {
        const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
        const config = await loadConfig(cwd);

        if (!opts.all && !opts.issue) {
          // eslint-disable-next-line no-console
          console.error(
            pc.red("Either --issue <ID> or --all is required."),
          );
          process.exitCode = 1;
          return;
        }

        const provider = await resolveProvider({ config });
        const token = await resolveGitHubToken();
        if (!token) throw new Error("No GITHUB_TOKEN found.");
        const adapter = createGitHubAdapter({
          token,
          repo: config.git.repo,
          defaultBranch: config.git.default_branch,
        });

        const playbookRoots = [
          BUNDLED_PLAYBOOKS_DIR,
          resolveRemotePlaybooksRoot(cwd),
          resolveLocalPlaybooksRoot(cwd),
        ];

        if (opts.all) {
          const severityRank: Record<string, number> = {
            info: 0,
            low: 1,
            medium: 2,
            high: 3,
            critical: 4,
          };
          const minRank = opts.severity
            ? severityRank[opts.severity.toLowerCase()] ?? 0
            : 0;

          // eslint-disable-next-line no-console
          console.log(
            pc.bold(
              `▶ Running agent pool (autonomy: ${config.agents.autonomy}, parallelism: ${config.agents.parallelism})`,
            ),
          );

          const result = await runAgentPool({
            cwd,
            config,
            provider,
            adapter,
            playbookRoots,
            filter: (i) => (severityRank[i.severity] ?? 0) >= minRank,
            onProgress: (ev) => {
              if (ev.type === "assigned") {
                // eslint-disable-next-line no-console
                console.log(
                  `  ${pc.dim("→")} ${ev.agent} picked up ${ev.issueId}`,
                );
              } else if (ev.type === "completed") {
                // eslint-disable-next-line no-console
                console.log(
                  `  ${pc.green("✔")} ${ev.agent} opened PR for ${ev.issueId}: ${pc.cyan(ev.prUrl)}`,
                );
              } else if (ev.type === "gated") {
                // eslint-disable-next-line no-console
                console.log(
                  `  ${pc.yellow("⏸")} ${ev.agent} paused on ${ev.issueId}: ${pc.dim(ev.reason)}`,
                );
              } else if (ev.type === "failed") {
                // eslint-disable-next-line no-console
                console.log(
                  `  ${pc.red("✖")} ${ev.agent} failed on ${ev.issueId}: ${pc.dim(ev.error)}`,
                );
              }
            },
          });

          // eslint-disable-next-line no-console
          console.log(pc.bold("\nAgent pool complete:"));
          // eslint-disable-next-line no-console
          console.log(`  completed:  ${pc.green(String(result.completed.length))}`);
          // eslint-disable-next-line no-console
          console.log(`  awaiting:   ${pc.yellow(String(result.gated.length))}  ${pc.dim("(run `opt approve` to unblock)")}`);
          // eslint-disable-next-line no-console
          console.log(`  failed:     ${pc.red(String(result.failed.length))}`);
          return;
        }

        // Single-issue path
        try {
          const result = await runAgent({
            issueId: opts.issue!,
            agentId: opts.agent,
            cwd,
            config,
            provider,
            adapter,
            playbookRoots,
          });
          // eslint-disable-next-line no-console
          console.log(
            pc.green(
              `✔ ${result.agent.displayName} ${result.agent.emoji} opened PR #${result.prNumber}`,
            ),
          );
          // eslint-disable-next-line no-console
          console.log(`  ${pc.cyan(result.prUrl)}`);
          // eslint-disable-next-line no-console
          console.log(`  Files changed: ${result.filesChanged.join(", ")}`);
        } catch (err) {
          if (err instanceof AgentApprovalRequired) {
            // eslint-disable-next-line no-console
            console.log(
              pc.yellow(
                `⏸ ${opts.issue} needs approval: ${err.reason}`,
              ),
            );
            // eslint-disable-next-line no-console
            console.log(
              pc.dim(
                `  Run \`opt approve --issue ${err.issueId}\` to unblock, or raise autonomy mode in .ohpentesting/config.yml.`,
              ),
            );
            process.exitCode = 4;
            return;
          }
          throw err;
        }
      },
    );
}
