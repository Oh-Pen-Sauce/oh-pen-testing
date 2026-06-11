import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerScan } from "./commands/scan.js";
import { registerScanDynamic } from "./commands/scan-dynamic.js";
import { registerRemediate } from "./commands/remediate.js";
import { registerVerify } from "./commands/verify.js";
import { registerApprove } from "./commands/approve.js";
import { registerSetup } from "./commands/setup.js";
import { registerConnect } from "./commands/connect.js";
import { registerReport } from "./commands/report.js";
import { registerSchedule } from "./commands/schedule.js";
import { registerShare } from "./commands/share.js";
import { registerTelemetry } from "./commands/telemetry.js";
import { registerPlaybooks } from "./commands/playbooks.js";
import { registerCompliance } from "./commands/compliance.js";
import { registerVersion } from "./commands/version.js";
import { registerAllProviders } from "./provider-registration.js";

export const CLI_VERSION = "1.0.4";

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
  registerConnect(program);
  registerReport(program);
  registerSchedule(program);
  registerShare(program);
  registerTelemetry(program);
  registerPlaybooks(program);
  registerCompliance(program);
  registerVersion(program);

  return program;
}

const MIN_NODE_MAJOR = 22;

export async function main(argv: string[] = process.argv): Promise<void> {
  const rest = argv.slice(2);

  // Diagnostic and help commands must work on any Node version, so a
  // user on an old runtime can still discover WHY things break. Every
  // other command needs Node 22+ (the Next 15 web wizard, server
  // actions). Gate the rest with a clear message instead of letting
  // them fail later with an opaque stack trace.
  const wantsDiagnostic =
    rest.length === 0 ||
    rest.some((a) =>
      ["info", "help", "--version", "-V", "--help", "-h"].includes(a),
    );
  const nodeMajor = Number.parseInt(
    process.versions.node.split(".")[0] ?? "0",
    10,
  );
  if (!wantsDiagnostic && nodeMajor < MIN_NODE_MAJOR) {
    // eslint-disable-next-line no-console
    console.error(
      `Oh Pen Testing needs Node.js ${MIN_NODE_MAJOR} or newer. You are on ${process.version}.`,
    );
    // eslint-disable-next-line no-console
    console.error(
      "Install it from https://nodejs.org or run `nvm install 22`.",
    );
    process.exitCode = 1;
    return;
  }

  const program = buildCli();

  // No subcommand: greet first-timers with a clear starting point, then
  // show the full help. argv is [node, script, ...rest].
  if (rest.length === 0) {
    // eslint-disable-next-line no-console
    console.log("Oh Pen Testing: local, AI-driven pen-testing for your repo.");
    // eslint-disable-next-line no-console
    console.log(
      "First time here? Run `opt setup` to scaffold this project and open the wizard.\n",
    );
    program.outputHelp();
    return;
  }

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
