import type { Command } from "commander";
import pc from "picocolors";
import { loadConfig, ScopeViolation } from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import { resolveProvider, runVerify } from "@oh-pen-testing/core";
import { resolveLocalPlaybooksRoot } from "../util/playbook-paths.js";

export function registerVerify(program: Command): void {
  program
    .command("verify")
    .description(
      "Rerun the playbook that flagged an issue to confirm the fix landed",
    )
    .requiredOption("-i, --issue <id>", "Issue ID, e.g. ISSUE-001")
    .option("-p, --provider <id>", "Override config.ai.primary_provider")
    .option("--skip-ai", "Skip AI confirmation (regex-only verification)")
    .action(
      async (opts: { issue: string; provider?: string; skipAi?: boolean }, cmd) => {
        const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
        const config = await loadConfig(cwd);

        if (opts.provider) {
          config.ai.primary_provider = opts.provider as typeof config.ai.primary_provider;
        }

        const provider = await resolveProvider({ config });

        try {
          const result = await runVerify({
            cwd,
            config,
            issueId: opts.issue,
            provider,
            playbookRoots: [
              BUNDLED_PLAYBOOKS_DIR,
              resolveLocalPlaybooksRoot(cwd),
            ],
            skipAiConfirm: opts.skipAi,
          });

          if (result.verified) {
            // eslint-disable-next-line no-console
            console.log(
              pc.green(
                `✔ ${result.issue.id} verified — 0 hits remaining in ${result.issue.location.file}`,
              ),
            );
            // eslint-disable-next-line no-console
            console.log(
              pc.dim(`  Status → verified · recorded at ${result.issue.verification.verified_at}`),
            );
          } else {
            // eslint-disable-next-line no-console
            console.log(
              pc.yellow(
                `⚠ ${result.issue.id}: ${result.hitsRemaining} hit(s) still present in ${result.issue.location.file}`,
              ),
            );
            // eslint-disable-next-line no-console
            console.log(
              pc.dim(
                `  Issue stays at status=${result.issue.status}. Review the fix and rerun verify.`,
              ),
            );
          }
        } catch (err) {
          if (err instanceof ScopeViolation) {
            // eslint-disable-next-line no-console
            console.error(pc.red(`\n✖ Scope violation (${err.kind}):`));
            // eslint-disable-next-line no-console
            console.error(pc.dim(`  ${err.message}`));
            process.exitCode = 3;
            return;
          }
          throw err;
        }
      },
    );
}
