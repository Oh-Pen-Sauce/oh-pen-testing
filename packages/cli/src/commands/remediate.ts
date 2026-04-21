import type { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import { resolveProvider, runAgent } from "@oh-pen-testing/core";
import {
  createGitHubAdapter,
  resolveGitHubToken,
} from "@oh-pen-testing/git-github";
import { resolveLocalPlaybooksRoot } from "../util/playbook-paths.js";

export function registerRemediate(program: Command): void {
  program
    .command("remediate")
    .description("Have an agent fix an issue and open a PR")
    .requiredOption("-i, --issue <id>", "Issue ID, e.g. ISSUE-001")
    .option("-a, --agent <name>", "Agent ID", "marinara")
    .action(async (opts: { issue: string; agent: string }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);

      const provider = await resolveProvider({ config });

      const token = await resolveGitHubToken();
      if (!token) throw new Error("No GITHUB_TOKEN found.");
      const adapter = createGitHubAdapter({
        token,
        repo: config.git.repo,
        defaultBranch: config.git.default_branch,
      });

      const result = await runAgent({
        issueId: opts.issue,
        agentId: opts.agent,
        cwd,
        config,
        provider,
        adapter,
        playbookRoots: [
          BUNDLED_PLAYBOOKS_DIR,
          resolveLocalPlaybooksRoot(cwd),
        ],
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
    });
}
