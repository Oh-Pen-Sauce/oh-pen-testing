import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * detect.ts calls `execFile` (via promisify) and `fs.existsSync` directly,
 * with no injectable seam, so we mock the node builtins. The mocked
 * `execFile` is shaped for promisify: it invokes its callback with either
 * an error or `(null, { stdout, stderr })`. Behaviour per binary path is
 * driven by the `execBehaviour` map that each test sets up.
 */

type ExecOutcome =
  | { kind: "ok"; stdout: string }
  | { kind: "fail"; message: string };

// bin path -> outcome for that binary's `--version` / `--help` call.
const execBehaviour = new Map<string, ExecOutcome>();
// Set of absolute paths that fs.existsSync should report as present.
const existingPaths = new Set<string>();

vi.mock("node:child_process", () => ({
  execFile: (
    file: string,
    _args: readonly string[],
    _opts: unknown,
    cb: (err: Error | null, out?: { stdout: string; stderr: string }) => void,
  ) => {
    const outcome = execBehaviour.get(file);
    if (!outcome || outcome.kind === "fail") {
      cb(new Error(outcome ? outcome.message : `command not found: ${file}`));
      return;
    }
    cb(null, { stdout: outcome.stdout, stderr: "" });
  },
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: (p: string) => existingPaths.has(p),
  },
  existsSync: (p: string) => existingPaths.has(p),
}));

// Imported after the mocks are registered.
const { detectClaudeCliInstalled, findClaudeBin, detectClaudeCliFlags } =
  await import("./index.js");

beforeEach(() => {
  execBehaviour.clear();
  existingPaths.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("findClaudeBin", () => {
  it("resolves `claude` on PATH when the bare call succeeds", async () => {
    execBehaviour.set("claude", { kind: "ok", stdout: "1.2.3 (Claude Code)\n" });

    const result = await findClaudeBin();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bin).toBe("claude");
      expect(result.version).toBe("1.2.3 (Claude Code)");
    }
  });

  it("falls back to a well-known install location when PATH misses", async () => {
    const homebrew = "/opt/homebrew/bin/claude";
    existingPaths.add(homebrew);
    execBehaviour.set(homebrew, { kind: "ok", stdout: "2.0.0\n" });

    const result = await findClaudeBin();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bin).toBe(homebrew);
      expect(result.version).toBe("2.0.0");
    }
  });

  it("skips candidate paths that do not exist on disk", async () => {
    // No paths exist; the only working binary lives at /usr/local/bin/claude
    // but existsSync reports it absent, so it must be skipped and we fail.
    execBehaviour.set("/usr/local/bin/claude", { kind: "ok", stdout: "9.9.9" });

    const result = await findClaudeBin();

    expect(result.ok).toBe(false);
  });

  it("returns a helpful error when claude is nowhere to be found", async () => {
    const result = await findClaudeBin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("'claude' not found");
      expect(result.error).toContain("https://claude.ai/download");
    }
  });
});

describe("detectClaudeCliInstalled", () => {
  it("reports installed with version and path when present on PATH", async () => {
    execBehaviour.set("claude", { kind: "ok", stdout: "1.5.0\n" });

    const detection = await detectClaudeCliInstalled();

    expect(detection.installed).toBe(true);
    expect(detection.version).toBe("1.5.0");
    expect(detection.path).toBe("claude");
    expect(detection.error).toBeUndefined();
  });

  it("reports not installed with an error when absent everywhere", async () => {
    const detection = await detectClaudeCliInstalled();

    expect(detection.installed).toBe(false);
    expect(detection.version).toBeUndefined();
    expect(detection.path).toBeUndefined();
    expect(detection.error).toContain("'claude' not found");
  });
});

describe("detectClaudeCliFlags", () => {
  it("returns the documented headless flags when --help advertises them", async () => {
    execBehaviour.set("claude", { kind: "ok", stdout: "1.0.0" });
    // findClaudeBin resolves `claude`, then --help is probed on the same bin.
    // The same execBehaviour entry serves both calls, and its stdout includes
    // the flag string the prober looks for.
    execBehaviour.set("claude", {
      kind: "ok",
      stdout: "Usage: claude [options]\n  --output-format <fmt>\n",
    });

    const flags = await detectClaudeCliFlags();

    expect(flags.promptFlag).toBe("-p");
    expect(flags.jsonFormat).toEqual(["--output-format", "json"]);
    expect(flags.streamFormat).toEqual(["--output-format", "stream-json"]);
  });

  it("falls back to the documented flags when claude is not found", async () => {
    const flags = await detectClaudeCliFlags();

    expect(flags.promptFlag).toBe("-p");
    expect(flags.jsonFormat).toEqual(["--output-format", "json"]);
    expect(flags.streamFormat).toEqual(["--output-format", "stream-json"]);
  });
});
