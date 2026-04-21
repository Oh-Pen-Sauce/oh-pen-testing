import type { Command } from "commander";
import pc from "picocolors";
import { confirm } from "@inquirer/prompts";
import {
  loadConfig,
  writeConfig,
  ConfigSchema,
  ScopeViolation,
} from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import { resolveProvider, runScan, RateLimitHalt } from "@oh-pen-testing/core";
import { resolveLocalPlaybooksRoot } from "../util/playbook-paths.js";

export function registerScan(program: Command): void {
  program
    .command("scan")
    .description("Run the configured playbooks against the current repo")
    .option("-p, --provider <id>", "Override config.ai.primary_provider")
    .action(async (opts: { provider?: string }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);

      // Principle 1: authorisation gate. Prompt on first scan in any repo,
      // then persist so subsequent scans don't nag.
      if (!config.scope.authorisation_acknowledged) {
        // eslint-disable-next-line no-console
        console.log(
          pc.yellow(
            "\n⚠  Authorisation check — Oh Pen Testing only scans code you're authorised to test.",
          ),
        );
        // eslint-disable-next-line no-console
        console.log(pc.dim(`   Target: ${cwd}\n`));
        const ack = await confirm({
          message:
            "Do you confirm you have authorisation to run security testing against this codebase?",
          default: false,
        });
        if (!ack) {
          // eslint-disable-next-line no-console
          console.log(
            pc.red(
              "✖ Scan cancelled. Only run Oh Pen Testing on code you own or have explicit permission to test.",
            ),
          );
          process.exitCode = 1;
          return;
        }
        config.scope.authorisation_acknowledged = true;
        config.scope.authorisation_acknowledged_at = new Date().toISOString();
        const validated = ConfigSchema.parse(config);
        await writeConfig(cwd, validated);
        // eslint-disable-next-line no-console
        console.log(pc.green("✔ Authorisation recorded. Proceeding with scan.\n"));
      }

      if (opts.provider) {
        config.ai.primary_provider = opts.provider as typeof config.ai.primary_provider;
      }

      const provider = await resolveProvider({ config });

      const playbookRoots = [
        BUNDLED_PLAYBOOKS_DIR,
        resolveLocalPlaybooksRoot(cwd),
      ];

      // eslint-disable-next-line no-console
      console.log(pc.bold(`▶ Scanning with ${provider.name} (${config.ai.model})`));

      try {
        const result = await runScan({
          cwd,
          config,
          provider,
          playbookRoots,
        });

        // eslint-disable-next-line no-console
        console.log(pc.green(`\n✔ Scan ${result.scanId} complete`));
        // eslint-disable-next-line no-console
        console.log(`  playbooks run:   ${result.scan.playbooks_run}`);
        // eslint-disable-next-line no-console
        console.log(`  issues found:    ${result.scan.issues_found}`);
        // eslint-disable-next-line no-console
        console.log(`  AI calls:        ${result.scan.ai_calls}`);

        if (result.issues.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`\n${pc.bold("Issues:")}`);
          for (const issue of result.issues) {
            const badge = severityColor(issue.severity)(
              `[${issue.severity.toUpperCase()}]`,
            );
            // eslint-disable-next-line no-console
            console.log(`  ${badge} ${issue.id} ${issue.title}`);
          }
          // eslint-disable-next-line no-console
          console.log(
            `\nRun ${pc.cyan("oh-pen-testing remediate --issue <ID>")} to fix one.`,
          );
        }
      } catch (err) {
        if (err instanceof RateLimitHalt) {
          // eslint-disable-next-line no-console
          console.error(
            pc.yellow(`\n⚠ ${err.message}`),
          );
          // eslint-disable-next-line no-console
          console.error(
            pc.dim(`  Scan ${err.scanId} saved with status=failed.`),
          );
          process.exitCode = 2;
          return;
        }
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
    });
}

function severityColor(severity: string): (s: string) => string {
  switch (severity) {
    case "critical":
      return pc.red;
    case "high":
      return pc.red;
    case "medium":
      return pc.yellow;
    case "low":
      return pc.blue;
    default:
      return pc.gray;
  }
}
