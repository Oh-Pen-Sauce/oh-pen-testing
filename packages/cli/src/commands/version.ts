import type { Command } from "commander";
import { DEFAULT_ANTHROPIC_MODEL } from "@oh-pen-testing/providers-anthropic";
import {
  loadConfig,
  getSecret,
  ohpenPaths,
  SECRET_ACCOUNTS,
} from "@oh-pen-testing/shared";
import { CLI_VERSION } from "../index.js";

/** Map a configured provider to the secret account that holds its key. */
function providerSecretAccount(provider: string): string | null {
  if (provider === "claude-api" || provider === "anthropic") {
    return SECRET_ACCOUNTS.anthropic;
  }
  if (provider === "openai") return SECRET_ACCOUNTS.openai;
  if (provider === "openrouter") return SECRET_ACCOUNTS.openrouter;
  // claude-code-cli uses your local Claude session; ollama runs locally.
  // Neither stores an API key in the secrets store.
  return null;
}

export function registerVersion(program: Command): void {
  program
    .command("info")
    .description("Print version, environment, and project diagnostics")
    .action(async () => {
      const cwd = (program.opts().cwd as string | undefined) ?? process.cwd();
      const out: string[] = [
        `oh-pen-testing ${CLI_VERSION}`,
        `node ${process.version} (${process.platform}/${process.arch})`,
        `default model: ${DEFAULT_ANTHROPIC_MODEL}`,
        `scan target (cwd): ${cwd}`,
      ];

      const { config: configPath } = ohpenPaths(cwd);
      let config: Awaited<ReturnType<typeof loadConfig>> | null = null;
      try {
        config = await loadConfig(cwd);
      } catch {
        config = null;
      }

      if (!config) {
        out.push("config: not found (run `opt setup` in this directory)");
      } else {
        const provider = config.ai.primary_provider;
        out.push(`config: ${configPath}`);
        out.push(`provider: ${provider}`);
        out.push(`model: ${config.ai.model}`);
        out.push(`autonomy: ${config.agents.autonomy}`);
        const account = providerSecretAccount(provider);
        if (account) {
          const { location } = await getSecret(account);
          out.push(
            location === "missing"
              ? "credential: not set (run `opt connect`)"
              : `credential: present (${location})`,
          );
        }
      }

      // eslint-disable-next-line no-console
      console.log(out.join("\n"));
    });
}
