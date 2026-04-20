import type { Command } from "commander";
import pc from "picocolors";

export function registerSchedule(program: Command): void {
  program
    .command("schedule")
    .description("Schedule recurring scans (M5+)")
    .option("--nightly", "Install a nightly cron entry")
    .action(() => {
      // eslint-disable-next-line no-console
      console.log(pc.yellow("Scheduled scans land in M5."));
    });
}
