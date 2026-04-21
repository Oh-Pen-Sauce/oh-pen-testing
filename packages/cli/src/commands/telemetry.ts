import type { Command } from "commander";
import pc from "picocolors";
import {
  ConfigSchema,
  loadConfig,
  newInstallId,
  writeConfig,
} from "@oh-pen-testing/shared";

export function registerTelemetry(program: Command): void {
  const cmd = program
    .command("telemetry")
    .description(
      "Control anonymous telemetry. Off by default — explicit opt-in only.",
    );

  cmd
    .command("enable")
    .description("Opt in to sending anonymous scan stats to oh-pen-sauce.com")
    .action(async (_opts, parent) => {
      const cwd: string = parent.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);
      config.telemetry.enabled = true;
      if (!config.telemetry.install_id)
        config.telemetry.install_id = newInstallId();
      const validated = ConfigSchema.parse(config);
      await writeConfig(cwd, validated);
      // eslint-disable-next-line no-console
      console.log(
        pc.green("✔ Telemetry enabled.") +
          pc.dim(
            ` install_id = ${config.telemetry.install_id?.slice(0, 10)}…`,
          ),
      );
      // eslint-disable-next-line no-console
      console.log(
        pc.dim(
          "  What's sent: counts only (files, lines, issues, severities, provider id).\n  Never sent: code, file paths, issue titles, repo URLs, credentials.",
        ),
      );
    });

  cmd
    .command("disable")
    .description("Opt out — stops sending any telemetry")
    .action(async (_opts, parent) => {
      const cwd: string = parent.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);
      config.telemetry.enabled = false;
      const validated = ConfigSchema.parse(config);
      await writeConfig(cwd, validated);
      // eslint-disable-next-line no-console
      console.log(pc.green("✔ Telemetry disabled."));
    });

  cmd
    .command("status")
    .description("Show current telemetry settings")
    .action(async (_opts, parent) => {
      const cwd: string = parent.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);
      // eslint-disable-next-line no-console
      console.log(
        `telemetry.enabled = ${config.telemetry.enabled ? pc.green("true") : pc.red("false")}`,
      );
      if (config.telemetry.install_id) {
        // eslint-disable-next-line no-console
        console.log(
          `telemetry.install_id = ${config.telemetry.install_id.slice(0, 10)}… (anonymous)`,
        );
      }
      if (config.telemetry.endpoint) {
        // eslint-disable-next-line no-console
        console.log(`telemetry.endpoint = ${config.telemetry.endpoint}`);
      }
    });
}
