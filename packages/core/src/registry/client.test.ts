import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fetchRegistryIndex, installPlaybook } from "./client.js";
import {
  RegistryError,
  type RegistryEntry,
  type RegistryIndex,
} from "./types.js";

function sha(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function mockResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registry client", () => {
  it("parses a valid v1 index", async () => {
    const index: RegistryIndex = {
      version: 1,
      playbooks: [
        {
          id: "community/example",
          description: "Example community playbook.",
          version: "1.0.0",
          severity_default: "medium",
          files: [
            {
              path: "manifest.yml",
              url: "https://example.test/manifest.yml",
              sha256: "a".repeat(64),
            },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(JSON.stringify(index))),
    );
    const parsed = await fetchRegistryIndex("https://example.test/index.json");
    expect(parsed.playbooks).toHaveLength(1);
    expect(parsed.playbooks[0]!.id).toBe("community/example");
  });

  it("rejects malformed indexes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(JSON.stringify({ version: 999 }))),
    );
    await expect(
      fetchRegistryIndex("https://example.test/broken.json"),
    ).rejects.toBeInstanceOf(RegistryError);
  });

  it("installs a playbook when SHA-256 matches", async () => {
    const manifestBody = "id: community/example\n";
    const scanBody = "# scan prompt\n";
    const entry: RegistryEntry = {
      id: "community/example",
      description: "ex",
      version: "1.0.0",
      severity_default: "medium",
      files: [
        {
          path: "manifest.yml",
          url: "https://example.test/m.yml",
          sha256: sha(manifestBody),
        },
        {
          path: "scan.prompt.md",
          url: "https://example.test/s.md",
          sha256: sha(scanBody),
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("m.yml")) {
          return new Response(manifestBody, { status: 200 });
        }
        return new Response(scanBody, { status: 200 });
      }),
    );

    const destRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opt-reg-"));
    try {
      const installed = await installPlaybook(entry, destRoot);
      const manifestRead = await fs.readFile(
        path.join(installed, "manifest.yml"),
        "utf-8",
      );
      const scanRead = await fs.readFile(
        path.join(installed, "scan.prompt.md"),
        "utf-8",
      );
      expect(manifestRead).toBe(manifestBody);
      expect(scanRead).toBe(scanBody);
      const meta = JSON.parse(
        await fs.readFile(path.join(installed, ".registry.json"), "utf-8"),
      );
      expect(meta.id).toBe("community/example");
    } finally {
      await fs.rm(destRoot, { recursive: true, force: true });
    }
  });

  it("rolls back and throws on SHA-256 mismatch", async () => {
    const entry: RegistryEntry = {
      id: "community/tampered",
      description: "ex",
      version: "1.0.0",
      severity_default: "medium",
      files: [
        {
          path: "manifest.yml",
          url: "https://example.test/m.yml",
          sha256: "b".repeat(64), // wrong
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("whatever", { status: 200 })),
    );

    const destRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opt-reg-"));
    try {
      await expect(installPlaybook(entry, destRoot)).rejects.toBeInstanceOf(
        RegistryError,
      );
      // destDir should have been cleaned up
      const dir = path.join(destRoot, "community", "tampered");
      await expect(fs.access(dir)).rejects.toThrow();
    } finally {
      await fs.rm(destRoot, { recursive: true, force: true });
    }
  });
});
