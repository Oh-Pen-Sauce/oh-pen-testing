import type { Command } from "commander";
import pc from "picocolors";
import { scaffold } from "@oh-pen-testing/core";
import type { Language } from "@oh-pen-testing/shared";

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
      // eslint-disable-next-line no-console
      console.log(`\n${pc.bold("Next steps:")}`);
      // eslint-disable-next-line no-console
      console.log(`  1. Set credentials:`);
      // eslint-disable-next-line no-console
      console.log(`     ${pc.dim("export ANTHROPIC_API_KEY=sk-ant-...")}`);
      // eslint-disable-next-line no-console
      console.log(`     ${pc.dim("export GITHUB_TOKEN=ghp_...")}`);
      // eslint-disable-next-line no-console
      console.log(`  2. Review ${pc.cyan(".ohpentesting/config.yml")}`);
      // eslint-disable-next-line no-console
      console.log(`  3. Run ${pc.cyan("oh-pen-testing scan")}`);
    });
}
