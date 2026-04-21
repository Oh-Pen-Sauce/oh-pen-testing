import { describe, expect, it } from "vitest";
import { createOllamaProvider, detectOllamaReachable } from "./index.js";

describe("OllamaProvider", () => {
  it("posts chat messages and parses non-streaming response", async () => {
    const calls: string[] = [];
    const stubFetch: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          model: "kimi-k2.6",
          message: { role: "assistant", content: "hello world" },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const provider = createOllamaProvider({ fetchImpl: stubFetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(calls).toContain("http://localhost:11434/api/chat");
    expect(result.text).toBe("hello world");
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
  });

  it("throws ProviderError on non-200", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response("server down", { status: 503 });
    const provider = createOllamaProvider({ fetchImpl: stubFetch });
    await expect(
      provider.complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/503/);
  });

  it("reports rateLimitStrategy as local", () => {
    const provider = createOllamaProvider({ fetchImpl: (async () =>
      new Response("{}")) as typeof fetch });
    expect(provider.rateLimitStrategy()).toEqual({ class: "local" });
  });

  it("detectOllamaReachable returns false on error", async () => {
    const stubFetch: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const ok = await detectOllamaReachable("http://localhost:99999", stubFetch);
    expect(ok).toBe(false);
  });

  it("detectOllamaReachable returns true on 200", async () => {
    const stubFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ version: "0.1.0" }), { status: 200 });
    const ok = await detectOllamaReachable(
      "http://localhost:11434",
      stubFetch,
    );
    expect(ok).toBe(true);
  });
});
