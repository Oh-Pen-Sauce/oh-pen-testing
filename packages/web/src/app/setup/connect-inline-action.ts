"use server";

import {
  buildDefaultConfig,
  ConfigSchema,
  loadConfig,
  writeConfig,
  type ProviderId,
} from "@oh-pen-testing/shared";
import {
  detectClaudeCliInstalled,
  findClaudeBin,
} from "@oh-pen-testing/providers-claude-code-cli";
import {
  detectOllamaReachable,
  DEFAULT_OLLAMA_BASE_URL,
} from "@oh-pen-testing/providers-ollama";
import { getOhpenCwd } from "../../lib/ohpen-cwd";

/**
 * In-browser equivalent of `opt connect` — collects the output lines
 * so the inline terminal UI can replay them like a real shell session.
 *
 * Keeps the logic in lock-step with packages/cli/src/commands/connect.ts
 * so the two paths stay honest: a user who runs `opt connect` in the
 * terminal and a user who clicks the big Run button see the exact same
 * set of checks happen.
 */

export interface ConnectLine {
  kind: "cmd" | "info" | "ok" | "error" | "detail";
  text: string;
}

export interface ConnectResult {
  ok: boolean;
  providerId: ProviderId;
  lines: ConnectLine[];
}

export async function connectInlineAction(
  providerId: ProviderId,
  opts: { model?: string } = {},
): Promise<ConnectResult> {
  const cwd = getOhpenCwd();
  const lines: ConnectLine[] = [];

  lines.push({
    kind: "cmd",
    text: `opt connect --provider ${providerId}${opts.model ? ` --model ${opts.model}` : ""}`,
  });
  lines.push({ kind: "info", text: "🍅 Oh Pen Testing — connect an AI" });
  lines.push({
    kind: "detail",
    text: "Marinara needs an AI brain before she can drive the rest of setup.",
  });

  // Load or scaffold config.
  let config;
  try {
    config = await loadConfig(cwd);
  } catch {
    config = buildDefaultConfig({
      projectName: cwd.split("/").pop() ?? "unnamed",
      languages: ["generic"],
    });
    lines.push({
      kind: "detail",
      text: `  Scaffolded fresh .ohpentesting/ in ${cwd}`,
    });
  }

  let detail = "probe skipped";
  try {
    if (providerId === "claude-code-cli") {
      lines.push({ kind: "detail", text: "  Looking for the `claude` binary…" });
      const detection = await detectClaudeCliInstalled();
      if (!detection.installed) {
        lines.push({
          kind: "error",
          text: `✖ ${detection.error ?? "Claude Code CLI not found"}`,
        });
        lines.push({
          kind: "detail",
          text: "  Install from https://claude.ai/download or brew install anthropic/claude/claude",
        });
        return { ok: false, providerId, lines };
      }
      const found = await findClaudeBin();
      if (!found.ok) {
        lines.push({ kind: "error", text: `✖ ${found.error}` });
        return { ok: false, providerId, lines };
      }
      detail = `found at ${found.bin}${found.version ? ` (${found.version})` : ""}`;
    } else if (providerId === "ollama") {
      const reachable = await detectOllamaReachable();
      if (!reachable) {
        lines.push({
          kind: "error",
          text: `✖ Ollama unreachable at ${DEFAULT_OLLAMA_BASE_URL}`,
        });
        lines.push({
          kind: "detail",
          text: "  Start it with `ollama serve` and try again.",
        });
        return { ok: false, providerId, lines };
      }
      detail = `reachable at ${DEFAULT_OLLAMA_BASE_URL}`;
    } else {
      // API-key providers — the terminal panel doesn't collect secrets
      // inline. Tell the user to either set the env var or use
      // `opt connect` in the terminal which has a masked password prompt.
      lines.push({
        kind: "detail",
        text: `  ${providerId} needs an API key. Paste it in the chat composer after this, or run \`opt connect --provider ${providerId}\` in your terminal for a keychain-backed prompt.`,
      });
      detail = "API-key provider — next: paste the key";
    }
  } catch (err) {
    lines.push({ kind: "error", text: `✖ ${(err as Error).message}` });
    return { ok: false, providerId, lines };
  }

  // Persist provider + model.
  config.ai.primary_provider = providerId;
  if (opts.model) {
    config.ai.model = opts.model;
  } else if (providerId === "claude-code-cli") {
    config.ai.model = "claude-sonnet-4-6";
  }
  try {
    const validated = ConfigSchema.parse(config);
    await writeConfig(cwd, validated);
  } catch (err) {
    lines.push({
      kind: "error",
      text: `✖ Could not write config: ${(err as Error).message}`,
    });
    return { ok: false, providerId, lines };
  }

  lines.push({
    kind: "ok",
    text: `✔ Connected: ${providerId}  ·  ${detail}`,
  });
  lines.push({
    kind: "detail",
    text: `  config.ai.primary_provider = ${providerId}`,
  });
  lines.push({
    kind: "detail",
    text: `  config.ai.model           = ${config.ai.model}`,
  });

  return { ok: true, providerId, lines };
}
