import type { Command } from "commander";
import { DEFAULT_ANTHROPIC_MODEL } from "@oh-pen-testing/providers-anthropic";
import { CLI_VERSION } from "../index.js";

export function registerVersion(program: Command): void {
  program
    .command("info")
    .description("Print version + environment info")
    .action(() => {
      // eslint-disable-next-line no-console
      console.log(`oh-pen-testing ${CLI_VERSION}`);
      // eslint-disable-next-line no-console
      console.log(`node ${process.version}`);
      // eslint-disable-next-line no-console
      console.log(`default model: ${DEFAULT_ANTHROPIC_MODEL}`);
    });
}
