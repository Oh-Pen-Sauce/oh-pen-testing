import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  SkillFrontmatterSchema,
  type SetupAssistantBundle,
  type Skill,
} from "./types.js";

/**
 * Load the durable setup-assistant bundle from disk.
 *
 * The bundle lives in `./assets/` — `memory.md` + `skills/*.md`. Each
 * skill file carries YAML frontmatter describing its id, description,
 * and input schema; the markdown body is the instructional content the
 * AI reads.
 *
 * This loader is Node-only. It's called from server actions, not from
 * the browser.
 */

let cached: SetupAssistantBundle | null = null;

function assetsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Dev (tsx / vitest): <pkg>/src/setup-assistant/loader.ts → ./assets
  // Build (tsup esm):  <pkg>/dist/index.js               → ../src/setup-assistant/assets
  const candidates = [
    path.join(here, "assets"),
    path.join(here, "..", "src", "setup-assistant", "assets"),
    path.join(here, "..", "..", "src", "setup-assistant", "assets"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "memory.md"))) return c;
  }
  throw new Error(
    `setup-assistant assets not found; looked under: ${candidates.join(", ")}`,
  );
}

function splitFrontmatter(
  source: string,
): { frontmatter: unknown; body: string } {
  // Expect the file to start with `---\n...yaml...\n---\n<body>`. If not,
  // treat the whole thing as the body with no frontmatter.
  if (!source.startsWith("---\n")) {
    return { frontmatter: {}, body: source };
  }
  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    return { frontmatter: {}, body: source };
  }
  const yamlText = source.slice(4, end);
  const body = source.slice(end + 4).replace(/^\s+/, "");
  return { frontmatter: parseYaml(yamlText), body };
}

function loadSkillFile(filePath: string): Skill {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = splitFrontmatter(raw);
  const parsed = SkillFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) {
    throw new Error(
      `Invalid skill frontmatter in ${filePath}: ${parsed.error.message}`,
    );
  }
  return {
    id: parsed.data.id,
    name: parsed.data.name,
    whenToUse: parsed.data.when_to_use,
    inputSchema: parsed.data.input_schema,
    body,
  };
}

/**
 * Synchronously load the bundle. Result is memoised — safe to call on
 * every request.
 */
export function loadSetupAssistantBundle(): SetupAssistantBundle {
  if (cached) return cached;

  const root = assetsRoot();
  const memory = fs.readFileSync(path.join(root, "memory.md"), "utf-8");

  const skillsDir = path.join(root, "skills");
  const files = fs
    .readdirSync(skillsDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const skills = files.map((f) => loadSkillFile(path.join(skillsDir, f)));

  // Sanity: all skill ids unique.
  const ids = new Set<string>();
  for (const s of skills) {
    if (ids.has(s.id)) {
      throw new Error(`Duplicate skill id: ${s.id}`);
    }
    ids.add(s.id);
  }

  cached = { memory, skills };
  return cached;
}

/**
 * For tests — clear the cache so reload picks up edits.
 */
export function __clearSetupAssistantCache(): void {
  cached = null;
}
