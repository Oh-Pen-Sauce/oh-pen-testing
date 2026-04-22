import { spawn } from "node:child_process";
import {
  type AIProvider,
  type CompletionChunk,
  type CompletionRequest,
  type CompletionResult,
  type RateLimitStrategy,
  ProviderError,
  RateLimitError,
} from "@oh-pen-testing/shared";
import {
  detectClaudeCliFlags,
  detectClaudeCliInstalled,
  findClaudeBin,
  type ClaudeCliFlags,
} from "./detect.js";

export { detectClaudeCliFlags, detectClaudeCliInstalled, findClaudeBin };
export type { ClaudeCliDetection, ClaudeCliFlags } from "./detect.js";

export const DEFAULT_CLAUDE_CLI_BIN = "claude";
export const DEFAULT_WINDOW_HOURS = 5;

export interface ClaudeCodeCliProviderOptions {
  /** Path to the `claude` binary; defaults to `claude` on PATH. */
  bin?: string;
  /** Override model — not all CLI versions support this; passed as env OHPEN_MODEL if set. */
  model?: string;
  /** Pre-detected flags; when omitted, detected at first call. */
  flags?: ClaudeCliFlags;
  /** Override default spawn function for testing. */
  spawnImpl?: typeof spawn;
}

interface ClaudeCliJsonResponse {
  type?: string;
  subtype?: string;
  result?: string;
  error?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export function createClaudeCodeCliProvider(
  options: ClaudeCodeCliProviderOptions = {},
): AIProvider {
  const spawnFn = options.spawnImpl ?? spawn;
  let cachedFlags: ClaudeCliFlags | undefined = options.flags;
  // Resolve the binary lazily: if the caller didn't pin a path we search
  // PATH + the common install locations once and cache the winner. This
  // is what makes `claude` work inside `next dev`-spawned children where
  // PATH is otherwise minimal.
  let resolvedBin: string | null = options.bin ?? null;

  async function getBin(): Promise<string> {
    if (resolvedBin) return resolvedBin;
    const found = await findClaudeBin();
    if (!found.ok) {
      throw new ProviderError(found.error);
    }
    resolvedBin = found.bin;
    return resolvedBin;
  }

  async function getFlags(): Promise<ClaudeCliFlags> {
    if (!cachedFlags) cachedFlags = await detectClaudeCliFlags();
    return cachedFlags;
  }

  function composePrompt(request: CompletionRequest): string {
    const sys = (request.system ?? []).map((b) => b.text).join("\n\n");
    const user = request.messages
      .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
      .join("\n\n");
    return sys ? `${sys}\n\n${user}` : user;
  }

  return {
    id: "claude-code-cli",
    name: "Claude Code CLI",
    capabilities: ["local-session", "streaming"],
    rateLimitStrategy(): RateLimitStrategy {
      return {
        class: "session-window",
        windowHours: DEFAULT_WINDOW_HOURS,
        haltAtPct: 90,
      };
    },

    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const flags = await getFlags();
      const bin = await getBin();
      const args = [
        flags.promptFlag,
        ...flags.jsonFormat,
      ];
      const prompt = composePrompt(request);
      const result = await runClaude(spawnFn, bin, args, prompt);
      const json = parseJsonSafely(result.stdout);
      if (json?.error) {
        if (/rate[ _-]?limit|session.*limit/i.test(json.error)) {
          throw new RateLimitError(json.error);
        }
        throw new ProviderError(json.error);
      }
      const text = typeof json?.result === "string" ? json.result : result.stdout;
      return {
        text,
        stopReason: "end_turn",
        usage: {
          inputTokens: json?.usage?.input_tokens ?? 0,
          outputTokens: json?.usage?.output_tokens ?? 0,
        },
        model: options.model ?? "claude-code-cli",
      };
    },

    async *completeStream(
      request: CompletionRequest,
    ): AsyncIterable<CompletionChunk> {
      const flags = await getFlags();
      const bin = await getBin();
      const args = [flags.promptFlag, ...flags.streamFormat];
      const prompt = composePrompt(request);
      const child = spawnFn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
      child.stdin?.write(prompt);
      child.stdin?.end();

      let buffer = "";
      let inputTokens = 0;
      let outputTokens = 0;
      for await (const chunk of child.stdout as AsyncIterable<Buffer>) {
        buffer += chunk.toString("utf-8");
        let nl: number;
        // eslint-disable-next-line no-cond-assign
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line) as ClaudeCliJsonResponse & {
              delta?: { text?: string };
            };
            if (obj.delta?.text) {
              yield { deltaText: obj.delta.text };
            }
            if (obj.usage?.input_tokens) inputTokens = obj.usage.input_tokens;
            if (obj.usage?.output_tokens) outputTokens = obj.usage.output_tokens;
            if (typeof obj.result === "string") {
              yield { deltaText: obj.result };
            }
          } catch {
            // Non-JSON line — treat as plain text delta
            yield { deltaText: line };
          }
        }
      }
      yield {
        deltaText: "",
        done: true,
        usage: { inputTokens, outputTokens },
      };
    },
  };
}

interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

async function runClaude(
  spawnFn: typeof spawn,
  bin: string,
  args: string[],
  prompt: string,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.stdin?.write(prompt);
    child.stdin?.end();
  });
}

function parseJsonSafely(raw: string): ClaudeCliJsonResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as ClaudeCliJsonResponse;
  } catch {
    // Try last newline-delimited JSON line
    const lines = trimmed.split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]!) as ClaudeCliJsonResponse;
      } catch {
        // keep trying
      }
    }
    return null;
  }
}
