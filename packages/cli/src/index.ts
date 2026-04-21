import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerScan } from "./commands/scan.js";
import { registerScanDynamic } from "./commands/scan-dynamic.js";
import { registerRemediate } from "./commands/remediate.js";
import { registerVerify } from "./commands/verify.js";
import { registerApprove } from "./commands/approve.js";
import { registerSetup } from "./commands/setup.js";
import { registerReport } from "./commands/report.js";
import { registerSchedule } from "./commands/schedule.js";
import { registerShare } from "./commands/share.js";
import { registerTelemetry } from "./commands/telemetry.js";
import { registerVersion } from "./commands/version.js";
import { registerAllProviders } from "./provider-registration.js";

export const CLI_VERSION = "0.6.0";

export function buildCli(): Command {
  registerAllProviders();
  const program = new Command();
  program
    .name("oh-pen-testing")
    .description(
      "Local opensource pen-testing suite. Your code. Your AI. Your terms.",
    )
    .version(CLI_VERSION)
    .option("--cwd <path>", "Working directory", process.cwd());

  registerInit(program);
  registerScan(program);
  registerScanDynamic(program);
  registerRemediate(program);
  registerVerify(program);
  registerApprove(program);
  registerSetup(program);
  registerReport(program);
  registerSchedule(program);
  registerShare(program);
  registerTelemetry(program);
  registerVersion(program);

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildCli();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

// Entry point
main();
