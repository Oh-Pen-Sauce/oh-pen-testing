import { registerProvider } from "@oh-pen-testing/core";
import {
  createAnthropicProvider,
  resolveAnthropicApiKey,
} from "@oh-pen-testing/providers-anthropic";
import { createClaudeCodeCliProvider } from "@oh-pen-testing/providers-claude-code-cli";
import { createOllamaProvider } from "@oh-pen-testing/providers-ollama";

let registered = false;

export function registerAllProviders(): void {
  if (registered) return;

  registerProvider("claude-api", async ({ config, apiKey, model }) => {
    const key = apiKey ?? (await resolveAnthropicApiKey());
    if (!key) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY. Set it in env or via `oh-pen-testing setup`.",
      );
    }
    return createAnthropicProvider({
      apiKey: key,
      model: model ?? config.ai.model,
    });
  });

  registerProvider("claude-max", async ({ config, model }) => {
    // claude-max is Claude API with Max-plan rate-limiting conventions.
    // Same SDK; rateLimitStrategy differs because we treat it like a session
    // window upstream. For M1 we route claude-max through claude-api unless
    // the Claude Code CLI is preferred (user choice).
    const key = await resolveAnthropicApiKey();
    if (!key) {
      throw new Error(
        "claude-max still requires an ANTHROPIC_API_KEY for the SDK.",
      );
    }
    return createAnthropicProvider({
      apiKey: key,
      model: model ?? config.ai.model,
    });
  });

  registerProvider("claude-code-cli", async ({ model }) => {
    return createClaudeCodeCliProvider({ model });
  });

  registerProvider("openai", async () => {
    throw new Error(
      "OpenAI provider lands in M2. Set primary_provider to claude-api, claude-code-cli, or ollama.",
    );
  });

  registerProvider("openrouter", async () => {
    throw new Error(
      "OpenRouter provider lands in M2. Set primary_provider to claude-api, claude-code-cli, or ollama.",
    );
  });

  registerProvider("ollama", async ({ config, model }) => {
    return createOllamaProvider({
      model: model ?? config.ai.model,
    });
  });

  registered = true;
}
