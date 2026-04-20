import type { Command } from "commander";
import pc from "picocolors";

export function registerReport(program: Command): void {
  program
    .command("report")
    .description("Generate a scan report (M2+)")
    .option("--format <format>", "markdown | json | sarif | pdf", "markdown")
    .action(() => {
      // eslint-disable-next-line no-console
      console.log(
        pc.yellow(
          "Report generation lands in M2 (markdown/json/sarif) and v1.0 (pdf).",
        ),
      );
    });
}
