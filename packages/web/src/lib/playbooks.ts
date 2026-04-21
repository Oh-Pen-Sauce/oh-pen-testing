import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  KNOWN_AGENTS,
  pickAgentForPlaybook,
  type AgentIdentity,
} from "@oh-pen-testing/core";

/**
 * Data for the /playbooks catalog page. Reads straight from the bundled
 * playbooks/core/ tree so the web UI and the scanner stay in sync.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
// web package's dist is at packages/web/.next/... so walk up accordingly.
// This runs from .next/server/app in prod, so let's resolve lazily.
function resolvePlaybooksRoot(): string {
  const candidates = [
    path.resolve(HERE, "../../../../playbooks/core"),
    path.resolve(HERE, "../../../../../playbooks/core"),
    path.resolve(HERE, "../../../../../../playbooks/core"),
    path.resolve(process.cwd(), "playbooks/core"),
    path.resolve(process.cwd(), "../playbooks/core"),
    path.resolve(process.cwd(), "../../playbooks/core"),
  ];
  return candidates[0]!;
}

export interface PlaybookCatalogRule {
  id: string;
  description: string;
  pattern?: string;
  flags?: string;
  require_ai_confirm: boolean;
}

export interface PlaybookCatalogEntry {
  id: string;
  displayName: string;
  category: string;
  owasp_ref?: string;
  cwe: string[];
  severity_default: string;
  languages: string[];
  description: string;
  risky: boolean;
  requires_ai: boolean;
  type: string;
  rules: PlaybookCatalogRule[];
  scanPrompt?: string;
  remediatePrompt?: string;
  assignedAgent: AgentIdentity;
}

async function walkPlaybookDirs(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      const manifestPath = path.join(full, "manifest.yml");
      try {
        await fs.access(manifestPath);
        out.push(full);
        continue;
      } catch {
        await recurse(full);
      }
    }
  }
  await recurse(root);
  return out;
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch {
    return undefined;
  }
}

export async function listCatalog(): Promise<PlaybookCatalogEntry[]> {
  const root = resolvePlaybooksRoot();
  const dirs = await walkPlaybookDirs(root);
  const out: PlaybookCatalogEntry[] = [];
  for (const dir of dirs) {
    try {
      const manifestRaw = await fs.readFile(
        path.join(dir, "manifest.yml"),
        "utf-8",
      );
      const manifest = parseYaml(manifestRaw) as {
        id: string;
        category: string;
        owasp_ref?: string;
        cwe?: string[];
        severity_default: string;
        languages?: string[];
        description?: string;
        risky?: boolean;
        requires_ai?: boolean;
        type?: string;
        rules?: Array<{
          id: string;
          description: string;
          pattern?: string;
          flags?: string;
          require_ai_confirm?: boolean;
        }>;
      };
      const [scanPrompt, remediatePrompt] = await Promise.all([
        readIfExists(path.join(dir, "scan.prompt.md")),
        readIfExists(path.join(dir, "remediate.prompt.md")),
      ]);
      const agent = pickAgentForPlaybook(manifest.id, manifest.owasp_ref);
      out.push({
        id: manifest.id,
        displayName: deriveDisplayName(manifest.id),
        category: manifest.category,
        owasp_ref: manifest.owasp_ref,
        cwe: manifest.cwe ?? [],
        severity_default: manifest.severity_default,
        languages: manifest.languages ?? ["generic"],
        description: manifest.description ?? "",
        risky: manifest.risky ?? false,
        requires_ai: manifest.requires_ai ?? true,
        type: manifest.type ?? "regex",
        rules:
          manifest.rules?.map((r) => ({
            id: r.id,
            description: r.description,
            pattern: r.pattern,
            flags: r.flags,
            require_ai_confirm: r.require_ai_confirm ?? true,
          })) ?? [],
        scanPrompt,
        remediatePrompt,
        assignedAgent: agent,
      });
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function deriveDisplayName(id: string): string {
  const last = id.split("/").pop() ?? id;
  return last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bSql\b/, "SQL")
    .replace(/\bXss\b/, "XSS")
    .replace(/\bXxe\b/, "XXE")
    .replace(/\bSri\b/, "SRI")
    .replace(/\bSsrf\b/, "SSRF")
    .replace(/\bTls\b/, "TLS")
    .replace(/\bSca\b/, "SCA")
    .replace(/\bIvn\b/, "IVN");
}

export async function getCatalogEntry(
  id: string,
): Promise<PlaybookCatalogEntry | null> {
  const all = await listCatalog();
  return all.find((p) => p.id === id) ?? null;
}

export function allAgents(): AgentIdentity[] {
  return Object.values(KNOWN_AGENTS);
}
