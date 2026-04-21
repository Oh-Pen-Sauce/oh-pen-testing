import { registerProvider } from "@oh-pen-testing/core";
import {
  createAnthropicProvider,
  resolveAnthropicApiKey,
} from "@oh-pen-testing/providers-anthropic";
import { createClaudeCodeCliProvider } from "@oh-pen-testing/providers-claude-code-cli";
import { createOllamaProvider } from "@oh-pen-testing/providers-ollama";

let done = false;

/**
 * Register all known providers. Idempotent. Called by server actions that
 * need resolveProvider() to work.
 */
export function ensureProvidersRegistered(): void {
  if (done) return;
  registerProvider("claude-api", async ({ config, apiKey, model }) => {
    const key = apiKey ?? (await resolveAnthropicApiKey());
    if (!key) throw new Error("Missing ANTHROPIC_API_KEY.");
    return createAnthropicProvider({
      apiKey: key,
      model: model ?? config.ai.model,
    });
  });
  registerProvider("claude-max", async ({ config, model }) => {
    const key = await resolveAnthropicApiKey();
    if (!key) throw new Error("claude-max requires ANTHROPIC_API_KEY.");
    return createAnthropicProvider({
      apiKey: key,
      model: model ?? config.ai.model,
    });
  });
  registerProvider("claude-code-cli", async ({ model }) => {
    return createClaudeCodeCliProvider({ model });
  });
  registerProvider("ollama", async ({ config, model }) => {
    return createOllamaProvider({ model: model ?? config.ai.model });
  });
  registerProvider("openai", async () => {
    throw new Error("OpenAI lands in M2.");
  });
  registerProvider("openrouter", async () => {
    throw new Error("OpenRouter lands in M2.");
  });
  done = true;
}
