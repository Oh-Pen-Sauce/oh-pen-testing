import type { Command } from "commander";
import pc from "picocolors";
import { scaffold } from "@oh-pen-testing/core";
import { loadConfig, type Language } from "@oh-pen-testing/shared";

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Scaffold .ohpentesting/ in the current repo")
    .option("-f, --force", "Overwrite existing config.yml")
    .option("-n, --project-name <name>", "Project name override")
    .option(
      "-l, --languages <csv>",
      "Comma-separated languages (javascript,typescript,python,...)",
    )
    .action(async (opts: { force?: boolean; projectName?: string; languages?: string }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const languages = opts.languages
        ? (opts.languages.split(",").map((s) => s.trim()).filter(Boolean) as Language[])
        : undefined;
      const result = await scaffold({
        cwd,
        overwrite: opts.force,
        projectName: opts.projectName,
        languages,
      });

      // eslint-disable-next-line no-console
      console.log(pc.green("✔ oh-pen-testing initialised"));
      for (const file of result.created) {
        // eslint-disable-next-line no-console
        console.log(`  ${pc.cyan("created")} ${file}`);
      }
      for (const file of result.skipped) {
        // eslint-disable-next-line no-console
        console.log(`  ${pc.gray("skipped")} ${file} (already exists — use --force to overwrite)`);
      }

      const config = await loadConfig(cwd);
      const provider = config.ai.primary_provider;

      // eslint-disable-next-line no-console
      console.log(
        `\n${pc.bold("Default provider:")} ${pc.cyan(provider)} (model: ${config.ai.model})`,
      );
      // eslint-disable-next-line no-console
      console.log(pc.dim("  Edit .ohpentesting/config.yml or use --provider on scan to override."));

      // eslint-disable-next-line no-console
      console.log(`\n${pc.bold("Next steps:")}`);
      if (provider === "claude-code-cli") {
        // eslint-disable-next-line no-console
        console.log(
          `  1. ${pc.dim("(no API key needed — uses your local `claude` CLI session)")}`,
        );
        // eslint-disable-next-line no-console
        console.log(`  2. Run ${pc.cyan("opt scan")}`);
        // eslint-disable-next-line no-console
        console.log(
          `  3. For PRs: ${pc.dim("export GITHUB_TOKEN=ghp_... && opt remediate --issue ISSUE-001")}`,
        );
      } else if (provider === "ollama") {
        // eslint-disable-next-line no-console
        console.log(
          `  1. ${pc.dim(`Make sure ollama is running: ollama serve + ollama pull ${config.ai.model}`)}`,
        );
        // eslint-disable-next-line no-console
        console.log(`  2. Run ${pc.cyan("opt scan")}`);
        // eslint-disable-next-line no-console
        console.log(
          `  3. For PRs: ${pc.dim("export GITHUB_TOKEN=ghp_... && opt remediate --issue ISSUE-001")}`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(`  1. Set credentials:`);
        // eslint-disable-next-line no-console
        console.log(`     ${pc.dim("export ANTHROPIC_API_KEY=sk-ant-...")}`);
        // eslint-disable-next-line no-console
        console.log(`     ${pc.dim("export GITHUB_TOKEN=ghp_...")}`);
        // eslint-disable-next-line no-console
        console.log(`  2. Run ${pc.cyan("opt scan")}`);
      }
      // eslint-disable-next-line no-console
      console.log(
        `\n  Prefer a UI? Run ${pc.cyan("opt setup")} to open the wizard at http://127.0.0.1:7676`,
      );
    });
}
