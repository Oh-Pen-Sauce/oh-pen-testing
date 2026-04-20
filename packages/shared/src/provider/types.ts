/**
 * The AIProvider interface. All LLM backends implement this contract so the
 * scanner and agents never know which model they're talking to.
 *
 * M0 only exposes non-streaming `complete`. Streaming is M1+.
 */

export interface CompletionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SystemBlock {
  text: string;
  /**
   * When true, the provider should attempt to cache this block. Maps to
   * Anthropic's `cache_control: { type: "ephemeral" }`. Other providers may
   * ignore.
   */
  cache?: boolean;
}

export interface CompletionRequest {
  system?: SystemBlock[];
  messages: CompletionMessage[];
  /** Maximum tokens in the response. */
  maxTokens?: number;
  /** Temperature 0-1. */
  temperature?: number;
  /**
   * When set, the provider should steer toward structured output matching
   * this JSON schema. Implementations may use tool-use or response-format
   * features. Schema is a minimal subset — stringified JSON schema object.
   */
  jsonSchema?: unknown;
}

export interface CompletionUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface CompletionResult {
  text: string;
  stopReason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "error";
  usage: CompletionUsage;
  model: string;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly string[];
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
