import type { Command } from "commander";
import pc from "picocolors";
import { select, password, confirm } from "@inquirer/prompts";
import {
  ConfigSchema,
  buildDefaultConfig,
  loadConfig,
  writeConfig,
  setSecret,
  type ProviderId,
} from "@oh-pen-testing/shared";
import { scaffold } from "@oh-pen-testing/core";
import {
  detectClaudeCliInstalled,
  findClaudeBin,
} from "@oh-pen-testing/providers-claude-code-cli";
import {
  detectOllamaReachable,
  DEFAULT_OLLAMA_BASE_URL,
} from "@oh-pen-testing/providers-ollama";

/**
 * `opt connect` — the first-time AI bootstrap, run from the terminal
 * where PATH actually works.
 *
 * Why this exists: when the web UI's `next dev` subprocess tries to
 * spawn `claude`, it inherits whatever PATH the dev-server inherited,
 * which on macOS + IDE launchers is often just /usr/bin:/bin. The CLI
 * doesn't have that problem — it sees the user's real PATH — so
 * running the AI connection here succeeds cleanly, writes the result
 * to config.yml, and the web UI opens in an already-connected state.
 */
export function registerConnect(program: Command): void {
  program
    .command("connect")
    .description(
      "Connect an AI provider from the terminal — writes the choice to .ohpentesting/config.yml so the web wizard can skip the provider step.",
    )
    .option(
      "--provider <id>",
      "Skip the picker: claude-code-cli | claude-api | openai | openrouter | ollama",
    )
    .option("--model <name>", "Override the default model for that provider")
    .option("--no-probe", "Skip the connectivity probe (write config anyway)")
    .action(
      async (
        opts: { provider?: string; model?: string; probe?: boolean },
        cmd,
      ) => {
        const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
        await scaffold({ cwd });

        let config;
        try {
          config = await loadConfig(cwd);
        } catch {
          config = buildDefaultConfig({
            projectName: cwd.split("/").pop() ?? "unnamed",
            languages: ["generic"],
          });
        }

        // eslint-disable-next-line no-console
        console.log(pc.bold("\n🍅 Oh Pen Testing — connect an AI"));
        // eslint-disable-next-line no-console
        console.log(
          pc.dim(
            "Marinara needs an AI brain before she can drive the rest of setup.\n",
          ),
        );

        const providerId = (opts.provider ??
          (await select<ProviderId>({
            message: "Which AI should Marinara use?",
            choices: [
              {
                value: "claude-code-cli",
                name: "Claude Code CLI  —  uses your local `claude` session, no API cost",
              },
              {
                value: "claude-api",
                name: "Claude API       —  Anthropic API key, billed per token",
              },
              {
                value: "openai",
                name: "OpenAI API       —  OpenAI API key",
              },
              {
                value: "openrouter",
                name: "OpenRouter       —  routes across many models",
              },
              {
                value: "ollama",
                name: "Ollama           —  local models on localhost:11434",
              },
            ],
            default: config.ai.primary_provider,
          }))) as ProviderId;

        // Run the connection check + save credentials
        const probe = opts.probe !== false;
        let probeDetail = "skipped";
        try {
          if (providerId === "claude-code-cli") {
            probeDetail = await connectClaudeCli(probe);
          } else if (providerId === "ollama") {
            probeDetail = await connectOllama(probe);
          } else if (providerId === "openai" || providerId === "openrouter") {
            // eslint-disable-next-line no-console
            console.log(
              pc.yellow(
                `\n⚠  ${providerId} provider support lands in a later milestone. Key saved for when it does.`,
              ),
            );
            probeDetail = await connectApiKeyProvider(providerId);
          } else {
            probeDetail = await connectApiKeyProvider(providerId);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(pc.red(`\n✖ ${(err as Error).message}`));
          process.exitCode = 1;
          return;
        }

        // Persist provider + model to config
        config.ai.primary_provider = providerId;
        if (opts.model) {
          config.ai.model = opts.model;
        } else if (providerId === "claude-code-cli" && !opts.model) {
          config.ai.model = "claude-sonnet-4-6";
        }
        const validated = ConfigSchema.parse(config);
        await writeConfig(cwd, validated);

        // eslint-disable-next-line no-console
        console.log(
          pc.green(`\n✔ Connected: ${pc.bold(providerId)}  ·  ${probeDetail}`),
        );
        // eslint-disable-next-line no-console
        console.log(
          pc.dim(
            `  config.ai.primary_provider = ${providerId}\n  config.ai.model           = ${validated.ai.model}`,
          ),
        );
        // eslint-disable-next-line no-console
        console.log(
          pc.bold("\nNext: ") +
            `${pc.cyan("opt setup")} ` +
            pc.dim(
              "— Marinara will pick up from here in the web wizard, or just run `opt scan` when you're ready.",
            ),
        );
      },
    );
}

async function connectClaudeCli(probe: boolean): Promise<string> {
  if (!probe) return "probe skipped";
  // eslint-disable-next-line no-console
  console.log(pc.dim("\n  Looking for the `claude` binary…"));
  const detection = await detectClaudeCliInstalled();
  if (!detection.installed) {
    throw new Error(
      `Claude Code CLI not found.\n  ${detection.error}\n  Install from https://claude.ai/download (or brew install anthropic/claude/claude).`,
    );
  }
  const found = await findClaudeBin();
  if (!found.ok) {
    throw new Error(found.error);
  }
  return `found at ${found.bin}${found.version ? ` (${found.version})` : ""}`;
}

async function connectOllama(probe: boolean): Promise<string> {
  if (!probe) return "probe skipped";
  const reachable = await detectOllamaReachable();
  if (!reachable) {
    throw new Error(
      `Ollama unreachable at ${DEFAULT_OLLAMA_BASE_URL}. Start it with \`ollama serve\` and try again.`,
    );
  }
  return `reachable at ${DEFAULT_OLLAMA_BASE_URL}`;
}

async function connectApiKeyProvider(providerId: ProviderId): Promise<string> {
  const accountName =
    providerId === "claude-api" || providerId === "claude-max"
      ? "anthropic-api-key"
      : providerId === "openai"
        ? "openai-api-key"
        : providerId === "openrouter"
          ? "openrouter-api-key"
          : "unknown";
  if (accountName === "unknown") {
    throw new Error(`Provider ${providerId} does not use an API key.`);
  }

  // If env var is already set, offer to use it
  const envVar =
    providerId === "claude-api" || providerId === "claude-max"
      ? "ANTHROPIC_API_KEY"
      : providerId === "openai"
        ? "OPENAI_API_KEY"
        : "OPENROUTER_API_KEY";
  if (process.env[envVar]) {
    const useEnv = await confirm({
      message: `${envVar} is set in the environment. Use that key?`,
      default: true,
    });
    if (useEnv) return `using ${envVar} from environment`;
  }

  const secret = await password({
    message: `Paste your ${providerId} API key:`,
    mask: true,
    validate: (v: string) =>
      v.length >= 10 || "That doesn't look like a key (too short).",
  });

  const result = await setSecret(accountName, secret);
  return result.detail;
}
