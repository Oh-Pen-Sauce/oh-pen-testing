import {
  type AIProvider,
  type CompletionChunk,
  type CompletionRequest,
  type CompletionResult,
  type RateLimitStrategy,
  ProviderError,
} from "@oh-pen-testing/shared";

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "kimi-k2.6";

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface OllamaChatChunk {
  model?: string;
  created_at?: string;
  message?: { role: string; content: string };
  done?: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export async function detectOllamaReachable(
  baseUrl = DEFAULT_OLLAMA_BASE_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${baseUrl}/api/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function createOllamaProvider(
  options: OllamaProviderOptions = {},
): AIProvider {
  const baseUrl = options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
  const model = options.model ?? process.env.OHPEN_MODEL ?? DEFAULT_OLLAMA_MODEL;
  const doFetch = options.fetchImpl ?? fetch;

  function buildBody(request: CompletionRequest, stream: boolean) {
    const messages = [] as Array<{ role: string; content: string }>;
    const sysText = (request.system ?? []).map((b) => b.text).join("\n\n");
    if (sysText) messages.push({ role: "system", content: sysText });
    for (const m of request.messages) {
      messages.push({ role: m.role, content: m.content });
    }
    return {
      model,
      messages,
      stream,
      options: {
        temperature: request.temperature ?? 0,
        num_predict: request.maxTokens ?? 2048,
      },
    };
  }

  return {
    id: "ollama",
    name: "Ollama (local)",
    capabilities: ["local", "streaming", "no-cost"],
    rateLimitStrategy(): RateLimitStrategy {
      return { class: "local" };
    },

    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const body = buildBody(request, false);
      let res: Response;
      try {
        res = await doFetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new ProviderError(
          `Failed to reach Ollama at ${baseUrl}: ${(err as Error).message}`,
        );
      }
      if (!res.ok) {
        const text = await res.text();
        throw new ProviderError(
          `Ollama responded ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as OllamaChatChunk;
      return {
        text: json.message?.content ?? "",
        stopReason: "end_turn",
        usage: {
          inputTokens: json.prompt_eval_count ?? 0,
          outputTokens: json.eval_count ?? 0,
        },
        model: json.model ?? model,
      };
    },

    async *completeStream(
      request: CompletionRequest,
    ): AsyncIterable<CompletionChunk> {
      const body = buildBody(request, true);
      const res = await doFetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        throw new ProviderError(`Ollama stream failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let inputTokens = 0;
      let outputTokens = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        // eslint-disable-next-line no-cond-assign
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line) as OllamaChatChunk;
            if (obj.message?.content) {
              yield { deltaText: obj.message.content };
            }
            if (obj.prompt_eval_count) inputTokens = obj.prompt_eval_count;
            if (obj.eval_count) outputTokens = obj.eval_count;
            if (obj.done) {
              yield {
                deltaText: "",
                done: true,
                usage: { inputTokens, outputTokens },
              };
              return;
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    },
  };
}
