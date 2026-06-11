import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError, RateLimitError } from "@oh-pen-testing/shared";

// The provider hard-imports the @anthropic-ai SDK and constructs the client
// inside createAnthropicProvider, so there is no fetch/client injection seam.
// We mock the SDK module wholesale: a controllable Anthropic class plus the
// two error classes the source uses for instanceof-based error mapping.
// Each test sets these handles before exercising the provider.
let createImpl: (args: unknown) => unknown;
let streamImpl: (args: unknown) => unknown;
const capturedCreateArgs: unknown[] = [];

class MockAPIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "APIError";
  }
}

class MockRateLimitError extends MockAPIError {
  constructor(message: string, headers?: Record<string, string>) {
    super(429, message, headers);
    this.name = "RateLimitError";
  }
}

class MockAnthropic {
  static APIError = MockAPIError;
  static RateLimitError = MockRateLimitError;
  apiKey: string;
  messages: {
    create: (args: unknown) => unknown;
    stream: (args: unknown) => unknown;
  };
  constructor(opts: { apiKey: string }) {
    this.apiKey = opts.apiKey;
    this.messages = {
      create: (args: unknown) => {
        capturedCreateArgs.push(args);
        return createImpl(args);
      },
      stream: (args: unknown) => streamImpl(args),
    };
  }
}

vi.mock("@anthropic-ai/sdk", () => ({ default: MockAnthropic }));

// Import after the mock is registered. vi.mock is hoisted, so a static
// import would also work, but this keeps the ordering explicit.
const {
  createAnthropicProvider,
  resolveAnthropicApiKey,
  DEFAULT_ANTHROPIC_MODEL,
} = await import("./index.js");

beforeEach(() => {
  capturedCreateArgs.length = 0;
  createImpl = () => {
    throw new Error("createImpl not set for this test");
  };
  streamImpl = () => {
    throw new Error("streamImpl not set for this test");
  };
});

afterEach(() => {
  delete process.env.OHPEN_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
});

function okResponse(overrides: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text", text: "all clear" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 12, output_tokens: 7 },
    model: "claude-opus-4-7",
    ...overrides,
  };
}

describe("AnthropicProvider metadata", () => {
  it("exposes stable provider identity and capabilities", () => {
    const provider = createAnthropicProvider({ apiKey: "sk-test" });
    expect(provider.id).toBe("claude-api");
    expect(provider.name).toBe("Anthropic Claude");
    expect(provider.capabilities).toContain("prompt-caching");
    expect(provider.capabilities).toContain("streaming");
  });

  it("reports an api-key rate-limit strategy with soft and hard caps", () => {
    const provider = createAnthropicProvider({ apiKey: "sk-test" });
    expect(provider.rateLimitStrategy()).toEqual({
      class: "api-key",
      softCapPct: 50,
      hardCapPct: 100,
    });
  });
});

describe("AnthropicProvider.complete request shape", () => {
  it("sends model, messages, system blocks and caps, then parses usage", async () => {
    createImpl = () => okResponse();
    const provider = createAnthropicProvider({
      apiKey: "sk-test",
      model: "claude-opus-4-7",
    });

    const result = await provider.complete({
      system: [
        { text: "stay terse" },
        { text: "cache me", cache: true },
      ],
      messages: [{ role: "user", content: "scan this" }],
      maxTokens: 256,
      temperature: 0.3,
    });

    expect(capturedCreateArgs).toHaveLength(1);
    const args = capturedCreateArgs[0] as Record<string, unknown>;
    expect(args.model).toBe("claude-opus-4-7");
    expect(args.max_tokens).toBe(256);
    expect(args.temperature).toBe(0.3);
    expect(args.messages).toEqual([{ role: "user", content: "scan this" }]);

    const system = args.system as Array<Record<string, unknown>>;
    expect(system[0]).toEqual({ type: "text", text: "stay terse" });
    expect(system[1]).toEqual({
      type: "text",
      text: "cache me",
      cache_control: { type: "ephemeral" },
    });

    expect(result.text).toBe("all clear");
    expect(result.stopReason).toBe("end_turn");
    expect(result.usage.inputTokens).toBe(12);
    expect(result.usage.outputTokens).toBe(7);
    expect(result.usage.cachedInputTokens).toBe(0);
    expect(result.model).toBe("claude-opus-4-7");
  });

  it("falls back to default model and max_tokens when none are supplied", async () => {
    createImpl = () => okResponse({ model: DEFAULT_ANTHROPIC_MODEL });
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });

    const args = capturedCreateArgs[0] as Record<string, unknown>;
    expect(args.model).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(args.max_tokens).toBe(4096);
    expect(args.temperature).toBe(0);
    expect(args.system).toBeUndefined();
  });

  it("reads cache_read_input_tokens into cachedInputTokens when present", async () => {
    createImpl = () =>
      okResponse({
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 64,
        },
      });
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.usage.cachedInputTokens).toBe(64);
  });

  it("maps each known stop_reason and defaults unknown ones to end_turn", async () => {
    const provider = createAnthropicProvider({ apiKey: "sk-test" });
    const cases: Array<[string | null, string]> = [
      ["end_turn", "end_turn"],
      ["max_tokens", "max_tokens"],
      ["stop_sequence", "stop_sequence"],
      ["tool_use", "tool_use"],
      ["something_unexpected", "end_turn"],
      [null, "end_turn"],
    ];
    for (const [raw, expected] of cases) {
      createImpl = () => okResponse({ stop_reason: raw });
      const result = await provider.complete({
        messages: [{ role: "user", content: "hi" }],
      });
      expect(result.stopReason).toBe(expected);
    }
  });

  it("returns empty text when the response has no text block", async () => {
    createImpl = () =>
      okResponse({ content: [{ type: "tool_use", id: "t1" }] });
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.text).toBe("");
  });

  it("honours OHPEN_MODEL when no model option is given", async () => {
    process.env.OHPEN_MODEL = "claude-sonnet-from-env";
    createImpl = () => okResponse({ model: "claude-sonnet-from-env" });
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    await provider.complete({ messages: [{ role: "user", content: "hi" }] });
    const args = capturedCreateArgs[0] as Record<string, unknown>;
    expect(args.model).toBe("claude-sonnet-from-env");
  });
});

describe("AnthropicProvider.complete error mapping", () => {
  it("maps an SDK RateLimitError to a typed RateLimitError with retryAfter", async () => {
    createImpl = () => {
      throw new MockRateLimitError("slow down", { "retry-after": "30" });
    };
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({
      name: "RateLimitError",
      retryAfterSeconds: 30,
    });
    await expect(
      provider.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("maps a 529 (overloaded) APIError to a typed ProviderError carrying the status", async () => {
    createImpl = () => {
      throw new MockAPIError(529, "overloaded");
    };
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    let caught: unknown;
    try {
      await provider.complete({
        messages: [{ role: "user", content: "hi" }],
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect((caught as ProviderError).code).toBe("529");
    expect((caught as ProviderError).message).toContain("overloaded");
  });

  it("re-throws non-SDK errors untouched", async () => {
    const boom = new Error("network exploded");
    createImpl = () => {
      throw boom;
    };
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBe(boom);
  });
});

describe("AnthropicProvider.completeStream", () => {
  it("yields text deltas and a final usage chunk", async () => {
    async function* fakeStream() {
      yield { type: "message_start", message: { usage: { input_tokens: 9 } } };
      yield {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "hel" },
      };
      yield {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "lo" },
      };
      yield { type: "message_delta", usage: { output_tokens: 3 } };
    }
    streamImpl = () => fakeStream();
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    const chunks: Array<{ deltaText: string; done?: boolean; usage?: unknown }> =
      [];
    for await (const chunk of provider.completeStream!({
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk);
    }

    const text = chunks.map((c) => c.deltaText).join("");
    expect(text).toBe("hello");
    const final = chunks.at(-1);
    expect(final?.done).toBe(true);
    expect(final?.usage).toEqual({ inputTokens: 9, outputTokens: 3 });
  });

  it("maps an SDK RateLimitError thrown mid-stream to a typed RateLimitError", async () => {
    async function* throwingStream() {
      // yield once so the loop starts, then fail
      yield {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "x" },
      };
      throw new MockRateLimitError("too fast", { "retry-after": "12" });
    }
    streamImpl = () => throwingStream();
    const provider = createAnthropicProvider({ apiKey: "sk-test" });

    const iterate = async () => {
      for await (const _ of provider.completeStream!({
        messages: [{ role: "user", content: "hi" }],
      })) {
        // drain
      }
    };
    await expect(iterate()).rejects.toMatchObject({
      name: "RateLimitError",
      retryAfterSeconds: 12,
    });
  });
});

describe("resolveAnthropicApiKey", () => {
  it("returns the key from the ANTHROPIC_API_KEY env var", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-from-env";
    const key = await resolveAnthropicApiKey();
    expect(key).toBe("sk-from-env");
  });

  it("returns null when no secret source has a key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const key = await resolveAnthropicApiKey();
    // No env var set, keychain/file fallback empty in CI: resolves to null.
    expect(key).toBeNull();
  });
});
