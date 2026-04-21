import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
  RegistryEntry,
  RegistryError,
  RegistryIndex,
  RegistryIndexSchema,
} from "./types.js";

const USER_AGENT = "oh-pen-testing/registry-client";

async function fetchText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      redirect: "follow",
    });
  } catch (err) {
    throw new RegistryError(
      "fetch_failed",
      `GET ${url} failed: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    throw new RegistryError(
      "fetch_failed",
      `GET ${url} returned HTTP ${res.status}`,
    );
  }
  return await res.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
  } catch (err) {
    throw new RegistryError(
      "fetch_failed",
      `GET ${url} failed: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    throw new RegistryError(
      "fetch_failed",
      `GET ${url} returned HTTP ${res.status}`,
    );
  }
  return new Uint8Array(await res.arrayBuffer());
}

function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Fetch and validate a registry index.
 *
 * Throws `RegistryError` on network failure or schema mismatch.
 */
export async function fetchRegistryIndex(
  url: string,
): Promise<RegistryIndex> {
  const text = await fetchText(url);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new RegistryError(
      "invalid_index",
      `Registry at ${url} is not valid JSON: ${(err as Error).message}`,
    );
  }
  const parsed = RegistryIndexSchema.safeParse(json);
  if (!parsed.success) {
    throw new RegistryError(
      "invalid_index",
      `Registry at ${url} does not match the v1 schema: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/**
 * Fetch *all* configured registries and return a flat, de-duplicated list
 * of entries. First registry to claim an id wins (config order).
 */
export async function fetchAllRegistryEntries(
  registryUrls: string[],
): Promise<
  Array<RegistryEntry & { registryUrl: string; maintainer?: string }>
> {
  const seen = new Set<string>();
  const out: Array<
    RegistryEntry & { registryUrl: string; maintainer?: string }
  > = [];
  for (const url of registryUrls) {
    const index = await fetchRegistryIndex(url);
    for (const entry of index.playbooks) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      out.push({
        ...entry,
        registryUrl: url,
        maintainer: index.maintainer?.name,
      });
    }
  }
  return out;
}

/**
 * Look up a single playbook by id across all configured registries.
 */
export async function findRegistryEntry(
  registryUrls: string[],
  playbookId: string,
): Promise<RegistryEntry & { registryUrl: string }> {
  for (const url of registryUrls) {
    const index = await fetchRegistryIndex(url);
    const hit = index.playbooks.find((p) => p.id === playbookId);
    if (hit) return { ...hit, registryUrl: url };
  }
  throw new RegistryError(
    "not_found",
    `Playbook '${playbookId}' not found in any configured registry.`,
  );
}

/**
 * Download one playbook to disk, verifying each file's SHA-256.
 *
 * On any mismatch the whole playbook is removed so we never end up with
 * a half-verified install. Returns the absolute directory it was
 * installed to.
 */
export async function installPlaybook(
  entry: RegistryEntry,
  destRoot: string,
): Promise<string> {
  const destDir = path.join(destRoot, entry.id.split("/").join(path.sep));
  await fs.mkdir(destDir, { recursive: true });

  const written: string[] = [];
  try {
    for (const file of entry.files) {
      const bytes = await fetchBytes(file.url);
      const got = sha256Hex(bytes);
      if (got !== file.sha256.toLowerCase()) {
        throw new RegistryError(
          "sha256_mismatch",
          `Playbook ${entry.id}: ${file.path} SHA-256 mismatch ` +
            `(expected ${file.sha256}, got ${got}). Aborting install.`,
        );
      }
      const outPath = path.join(destDir, file.path);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, bytes);
      written.push(outPath);
    }
  } catch (err) {
    // Roll back — leave no half-verified playbook behind.
    await fs.rm(destDir, { recursive: true, force: true });
    throw err;
  }

  // Record install metadata so `opt playbooks update` knows the source.
  const meta = {
    id: entry.id,
    version: entry.version,
    installed_at: new Date().toISOString(),
    files: entry.files.map((f) => ({ path: f.path, sha256: f.sha256 })),
  };
  await fs.writeFile(
    path.join(destDir, ".registry.json"),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );
  return destDir;
}
