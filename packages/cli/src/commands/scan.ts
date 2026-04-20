import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "@oh-pen-testing/shared";
import {
  createAnthropicProvider,
  resolveAnthropicApiKey,
} from "@oh-pen-testing/providers-anthropic";
import { runScan } from "@oh-pen-testing/core";
import { resolveBundledPlaybooksRoot, resolveLocalPlaybooksRoot } from "../util/playbook-paths.js";

export function registerScan(program: Command): void {
  program
    .command("scan")
    .description("Run the configured playbooks against the current repo")
    .action(async (_opts, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);

      const apiKey = await resolveAnthropicApiKey();
      if (!apiKey) {
        throw new Error(
          "No ANTHROPIC_API_KEY found. Set it in env or store it in the OS keychain (see `oh-pen-testing setup`).",
        );
      }

      const provider = createAnthropicProvider({
        apiKey,
        model: config.ai.model,
      });

      const playbookRoots = [
        resolveBundledPlaybooksRoot(),
        resolveLocalPlaybooksRoot(cwd),
      ];

      // eslint-disable-next-line no-console
      console.log(pc.bold(`▶ Scanning with ${provider.name} (${config.ai.model})`));

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
          const badge = severityColor(issue.severity)(`[${issue.severity.toUpperCase()}]`);
          // eslint-disable-next-line no-console
          console.log(`  ${badge} ${issue.id} ${issue.title}`);
        }
        // eslint-disable-next-line no-console
        console.log(
          `\nRun ${pc.cyan("oh-pen-testing remediate --issue <ID>")} to fix one.`,
        );
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
