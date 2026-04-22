import Anthropic from "@anthropic-ai/sdk";
import {
  type AIProvider,
  type CompletionChunk,
  type CompletionRequest,
  type CompletionResult,
  type RateLimitStrategy,
  ProviderError,
  RateLimitError,
} from "@oh-pen-testing/shared";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-7";
export const KEYTAR_SERVICE = "oh-pen-testing";
export const KEYTAR_ACCOUNT_ANTHROPIC = "anthropic-api-key";

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Resolve an Anthropic API key via the three-tier secrets store:
 *   1. ANTHROPIC_API_KEY env var
 *   2. OS keychain (account: anthropic-api-key)
 *   3. ~/.ohpentesting/secrets.json fallback file
 * Returns null if none of them have it.
 */
export async function resolveAnthropicApiKey(): Promise<string | null> {
  const { getSecret } = await import("@oh-pen-testing/shared");
  const result = await getSecret(KEYTAR_ACCOUNT_ANTHROPIC);
  return result.value;
}

export function createAnthropicProvider(
  options: AnthropicProviderOptions,
): AIProvider {
  const model = options.model ?? process.env.OHPEN_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
  const client = new Anthropic({ apiKey: options.apiKey });

  const buildSystem = (request: CompletionRequest) =>
    request.system?.map((block) => ({
      type: "text" as const,
      text: block.text,
      ...(block.cache
        ? { cache_control: { type: "ephemeral" as const } }
        : {}),
    }));

  return {
    id: "claude-api",
    name: "Anthropic Claude",
    capabilities: ["prompt-caching", "json-output", "long-context", "streaming"],
    rateLimitStrategy(): RateLimitStrategy {
      return { class: "api-key", softCapPct: 50, hardCapPct: 100 };
    },
    async *completeStream(
      request: CompletionRequest,
    ): AsyncIterable<CompletionChunk> {
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: request.maxTokens ?? options.maxTokens ?? 4096,
          temperature: request.temperature ?? 0,
          system: buildSystem(request),
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });
        let inputTokens = 0;
        let outputTokens = 0;
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            yield { deltaText: event.delta.text };
          } else if (event.type === "message_delta" && event.usage) {
            outputTokens = event.usage.output_tokens;
          } else if (event.type === "message_start" && event.message.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
        }
        yield {
          deltaText: "",
          done: true,
          usage: { inputTokens, outputTokens },
        };
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          const retryAfter = err.headers?.["retry-after"];
          throw new RateLimitError(
            `Anthropic rate limit: ${err.message}`,
            retryAfter ? Number(retryAfter) : undefined,
          );
        }
        throw err;
      }
    },
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      try {
        const response = await client.messages.create({
          model,
          max_tokens: request.maxTokens ?? options.maxTokens ?? 4096,
          temperature: request.temperature ?? 0,
          system: buildSystem(request),
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        const textBlock = response.content.find((b) => b.type === "text");
        const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

        // Cache-read tokens are only present when prompt caching is active
        // and the SDK version exposes them. Use a defensive cast.
        const cachedRead =
          (response.usage as unknown as Record<string, number>)
            .cache_read_input_tokens ?? 0;

        return {
          text,
          stopReason: mapStopReason(response.stop_reason),
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cachedInputTokens: cachedRead,
          },
          model: response.model,
        };
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          const retryAfter = err.headers?.["retry-after"];
          throw new RateLimitError(
            `Anthropic rate limit: ${err.message}`,
            retryAfter ? Number(retryAfter) : undefined,
          );
        }
        if (err instanceof Anthropic.APIError) {
          throw new ProviderError(
            `Anthropic API error: ${err.message}`,
            String(err.status),
          );
        }
        throw err;
      }
    },
  };
}

function mapStopReason(
  raw: string | null | undefined,
): CompletionResult["stopReason"] {
  switch (raw) {
    case "end_turn":
      return "end_turn";
    case "max_tokens":
      return "max_tokens";
    case "stop_sequence":
      return "stop_sequence";
    case "tool_use":
      return "tool_use";
    default:
      return "end_turn";
  }
}
