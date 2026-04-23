import type { ProviderId } from "./config/schema.js";

/**
 * Known models per provider. Used to populate dropdowns in the web UI
 * and to constrain the `set_model` setup-assistant skill's input.
 *
 * This is a convenience list, not a hard gate — users can still point
 * their config at any model string the provider accepts (especially
 * useful for Ollama where users pick whatever model they pulled).
 * The web dropdown offers a "custom…" escape hatch.
 */

export interface ModelChoice {
  id: string;
  label: string;
  /** Short blurb for the dropdown hover / list item. */
  note?: string;
}

export const MODEL_CATALOG: Record<ProviderId, ModelChoice[]> = {
  "claude-api": [
    {
      id: "claude-opus-4-7",
      label: "Claude Opus 4.7",
      note: "Most capable; higher cost per token",
    },
    {
      id: "claude-sonnet-4-6",
      label: "Claude Sonnet 4.6",
      note: "Great balance — default for most scans",
    },
    {
      id: "claude-haiku-4-5",
      label: "Claude Haiku 4.5",
      note: "Fastest + cheapest; good for high-volume regex confirmation",
    },
  ],
  "claude-max": [
    {
      id: "claude-opus-4-7",
      label: "Claude Opus 4.7",
      note: "Most capable; higher cost per token",
    },
    {
      id: "claude-sonnet-4-6",
      label: "Claude Sonnet 4.6",
      note: "Great balance — default for most scans",
    },
    {
      id: "claude-haiku-4-5",
      label: "Claude Haiku 4.5",
      note: "Fastest + cheapest; good for high-volume regex confirmation",
    },
  ],
  "claude-code-cli": [
    {
      id: "claude-sonnet-4-6",
      label: "Claude Sonnet 4.6 (CLI default)",
      note: "Rides your local claude session — no per-token cost",
    },
    {
      id: "claude-opus-4-7",
      label: "Claude Opus 4.7 (CLI)",
      note: "If your Max plan tier allows it",
    },
    {
      id: "claude-haiku-4-5",
      label: "Claude Haiku 4.5 (CLI)",
      note: "Fastest; eats less of your session budget",
    },
  ],
  openai: [
    {
      id: "gpt-4o",
      label: "GPT-4o",
      note: "OpenAI's flagship multimodal model",
    },
    {
      id: "gpt-4o-mini",
      label: "GPT-4o mini",
      note: "Cheap + fast; solid for regex confirmation",
    },
    {
      id: "o1",
      label: "o1",
      note: "Reasoning model — slower, best for complex scans",
    },
    {
      id: "o1-mini",
      label: "o1-mini",
      note: "Reasoning, cheaper variant",
    },
  ],
  openrouter: [
    {
      id: "anthropic/claude-sonnet-4.6",
      label: "Anthropic · Claude Sonnet 4.6 (via OpenRouter)",
    },
    {
      id: "anthropic/claude-opus-4.7",
      label: "Anthropic · Claude Opus 4.7 (via OpenRouter)",
    },
    {
      id: "openai/gpt-4o",
      label: "OpenAI · GPT-4o (via OpenRouter)",
    },
    {
      id: "openai/gpt-4o-mini",
      label: "OpenAI · GPT-4o mini (via OpenRouter)",
    },
  ],
  ollama: [
    {
      id: "kimi-k2.6",
      label: "Kimi K2.6 (default)",
      note: "~6 GB RAM — good general-purpose local model",
    },
    {
      id: "llama3.1:8b",
      label: "Llama 3.1 8B",
      note: "~4.7 GB RAM — solid fallback",
    },
    {
      id: "deepseek-coder-v2:16b",
      label: "DeepSeek Coder v2 16B",
      note: "~8.9 GB RAM — best-in-class for code if you have the memory",
    },
    {
      id: "phi3.5:3.8b",
      label: "Phi 3.5 3.8B",
      note: "Small + fast; good for laptops short on RAM",
    },
  ],
};

/**
 * List of all model ids across every provider — useful for schema
 * validation where the AI proposes a set_model action and we want to
 * accept any known model regardless of provider.
 */
export const ALL_KNOWN_MODEL_IDS: readonly string[] = Array.from(
  new Set(
    Object.values(MODEL_CATALOG).flatMap((choices) =>
      choices.map((c) => c.id),
    ),
  ),
);

/**
 * Get the default model for a provider — first entry in the catalog,
 * or null if the provider isn't known.
 */
export function defaultModelFor(providerId: ProviderId): string | null {
  return MODEL_CATALOG[providerId]?.[0]?.id ?? null;
}
