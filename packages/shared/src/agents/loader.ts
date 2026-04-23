import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Agent profile loader.
 *
 * Each agent (marinara / carbonara / alfredo / pesto) has:
 *
 *   - A bundled memory.md (system prompt / backstory + how the
 *     agent confirms findings) under
 *     packages/shared/src/agents/assets/<id>/memory.md
 *
 *   - A bundled playbooks.yml listing which bundled playbooks
 *     route to this agent by default
 *
 *   - Per-project overrides + custom additions under each scan
 *     target's `.ohpentesting/agents/<id>/`:
 *
 *       memory.md           → replaces the bundled memory.md entirely
 *       playbooks.yml       → extends / replaces bundled playbooks
 *       skills/<name>.md    → user-authored custom skills (markdown
 *                             files with free-form content the agent
 *                             references when running)
 *
 * The loader returns a merged `AgentProfile` for UI rendering and
 * downstream runners. The UI surfaces which fields are bundled
 * (read-only) vs overridden (project-local, editable).
 */

export type AgentId = "marinara" | "carbonara" | "alfredo" | "pesto";

export const AGENT_IDS: AgentId[] = [
  "marinara",
  "carbonara",
  "alfredo",
  "pesto",
];

const PlaybooksDocSchema = z.object({
  playbooks: z.array(z.string()).default([]),
});

export interface AgentSkill {
  /** Filename minus extension. */
  id: string;
  /** Relative path inside the project (for deletion etc.) */
  filename: string;
  /** Markdown body. */
  body: string;
  /** Only custom skills have this set — always true for now since we
   *  don't ship bundled skills yet. Kept as a field so we can extend
   *  cleanly later. */
  custom: boolean;
}

export interface AgentProfile {
  id: AgentId;
  /** Memory source — "bundled" if we fell back to defaults, "project"
   *  if `.ohpentesting/agents/<id>/memory.md` was found and used. */
  memorySource: "bundled" | "project";
  memory: string;
  /** Absolute path the memory was loaded from (for "where is this?"
   *  tooltips in the UI). */
  memoryPath: string;
  /** Assigned playbooks after merging bundled + project overrides. */
  playbooks: string[];
  /** Where the playbooks list came from. */
  playbooksSource: "bundled" | "project";
  /** Per-project custom skills — user-authored markdown files under
   *  .ohpentesting/agents/<id>/skills/. Empty array if none. */
  customSkills: AgentSkill[];
  /** Absolute path to the per-project agent dir (may not exist yet
   *  if the user hasn't overridden anything). */
  projectDir: string;
  /** Absolute path to the bundled agent dir (always exists). */
  bundledDir: string;
}

function bundledAssetsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Dev (tsx): <shared>/src/agents/loader.ts → <shared>/src/agents/assets
  // Build (tsup): <shared>/dist/index.js → <shared>/dist/agents-assets
  //   (mirrored by tsup onSuccess — see packages/shared/tsup.config.ts)
  const candidates = [
    path.join(here, "assets"),
    path.join(here, "..", "agents", "assets"),
    path.join(here, "..", "..", "src", "agents", "assets"),
    path.join(here, "agents-assets"), // dist-bundled copy
    path.join(here, "..", "agents-assets"),
  ];
  for (const c of candidates) {
    if (fsSync.existsSync(path.join(c, "marinara", "memory.md"))) {
      return c;
    }
  }
  throw new Error(
    `agent assets not found; looked under: ${candidates.join(", ")}`,
  );
}

function projectAgentDir(cwd: string, id: AgentId): string {
  return path.join(cwd, ".ohpentesting", "agents", id);
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Load the merged profile for a single agent, given the current scan
 * target's cwd.
 */
export async function loadAgentProfile(
  cwd: string,
  id: AgentId,
): Promise<AgentProfile> {
  const bundledDir = path.join(bundledAssetsRoot(), id);
  const projectDir = projectAgentDir(cwd, id);

  // Memory — project override beats bundled.
  const projectMemoryPath = path.join(projectDir, "memory.md");
  const bundledMemoryPath = path.join(bundledDir, "memory.md");
  const projectMemory = await readFileIfExists(projectMemoryPath);
  const memory =
    projectMemory ??
    (await readFileIfExists(bundledMemoryPath)) ??
    `# ${id}\n\n(no memory authored yet)`;
  const memorySource: "bundled" | "project" =
    projectMemory !== null ? "project" : "bundled";
  const memoryPath =
    projectMemory !== null ? projectMemoryPath : bundledMemoryPath;

  // Playbooks list — project override beats bundled. We don't merge
  // because the user may want to narrow the scope; the revert action
  // drops the override.
  const projectPlaybooksRaw = await readFileIfExists(
    path.join(projectDir, "playbooks.yml"),
  );
  const bundledPlaybooksRaw = await readFileIfExists(
    path.join(bundledDir, "playbooks.yml"),
  );
  let playbooks: string[] = [];
  let playbooksSource: "bundled" | "project" = "bundled";
  if (projectPlaybooksRaw !== null) {
    try {
      const parsed = PlaybooksDocSchema.parse(
        parseYaml(projectPlaybooksRaw) ?? {},
      );
      playbooks = parsed.playbooks;
      playbooksSource = "project";
    } catch {
      /* malformed — fall through to bundled */
    }
  }
  if (playbooksSource === "bundled" && bundledPlaybooksRaw !== null) {
    try {
      const parsed = PlaybooksDocSchema.parse(
        parseYaml(bundledPlaybooksRaw) ?? {},
      );
      playbooks = parsed.playbooks;
    } catch {
      /* malformed — leave empty */
    }
  }

  // Custom skills — everything under .ohpentesting/agents/<id>/skills/
  // that ends in .md. We don't ship bundled skills today; this is pure
  // user-authored content.
  const customSkills: AgentSkill[] = [];
  const skillsDir = path.join(projectDir, "skills");
  try {
    const entries = await fs.readdir(skillsDir);
    for (const filename of entries.sort()) {
      if (!filename.endsWith(".md")) continue;
      const body = await readFileIfExists(path.join(skillsDir, filename));
      if (body === null) continue;
      customSkills.push({
        id: filename.replace(/\.md$/, ""),
        filename,
        body,
        custom: true,
      });
    }
  } catch {
    /* no skills dir yet — fine */
  }

  return {
    id,
    memorySource,
    memory,
    memoryPath,
    playbooks,
    playbooksSource,
    customSkills,
    projectDir,
    bundledDir,
  };
}

export async function loadAllAgentProfiles(
  cwd: string,
): Promise<AgentProfile[]> {
  return Promise.all(AGENT_IDS.map((id) => loadAgentProfile(cwd, id)));
}

/**
 * Write a project-local memory override. Creates the agent dir if
 * missing. No-op rejection of empty strings — revert should be a
 * separate action.
 */
export async function writeAgentMemoryOverride(
  cwd: string,
  id: AgentId,
  body: string,
): Promise<void> {
  if (!body.trim()) {
    throw new Error("Memory body is empty. Use revertAgentMemory instead.");
  }
  const dir = projectAgentDir(cwd, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "memory.md"), body, "utf-8");
}

/**
 * Delete the project-local memory override — subsequent loads fall
 * back to the bundled memory.md.
 */
export async function revertAgentMemory(
  cwd: string,
  id: AgentId,
): Promise<void> {
  const filePath = path.join(projectAgentDir(cwd, id), "memory.md");
  try {
    await fs.unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}

/**
 * Persist a playbooks.yml override with the given id list. Empty
 * array is valid — it means "this agent owns no playbooks". Revert
 * via revertAgentPlaybooks.
 */
export async function writeAgentPlaybooksOverride(
  cwd: string,
  id: AgentId,
  playbooks: string[],
): Promise<void> {
  const dir = projectAgentDir(cwd, id);
  await fs.mkdir(dir, { recursive: true });
  const body =
    `# Project-local playbook assignment for ${id}.\n` +
    `# Delete this file or hit "Revert" in the UI to go back to the\n` +
    `# bundled list.\n\n` +
    `playbooks:\n` +
    playbooks.map((p) => `  - ${p}`).join("\n") +
    "\n";
  await fs.writeFile(path.join(dir, "playbooks.yml"), body, "utf-8");
}

export async function revertAgentPlaybooks(
  cwd: string,
  id: AgentId,
): Promise<void> {
  const filePath = path.join(projectAgentDir(cwd, id), "playbooks.yml");
  try {
    await fs.unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}

/**
 * Write a custom skill file. Skill ids are filename-safe — callers
 * should normalise before passing. No-op if the filename would
 * escape the skills dir (prevents ../etc traversal).
 */
export async function writeAgentSkill(
  cwd: string,
  id: AgentId,
  skillId: string,
  body: string,
): Promise<AgentSkill> {
  const safeId = skillId
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!safeId) {
    throw new Error("Skill id must contain letters or numbers.");
  }
  const dir = path.join(projectAgentDir(cwd, id), "skills");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${safeId}.md`;
  await fs.writeFile(path.join(dir, filename), body, "utf-8");
  return { id: safeId, filename, body, custom: true };
}

export async function deleteAgentSkill(
  cwd: string,
  id: AgentId,
  skillId: string,
): Promise<void> {
  const safeId = skillId.replace(/\.md$/, "");
  if (!/^[a-z0-9_-]+$/i.test(safeId)) {
    throw new Error("Invalid skill id.");
  }
  const filePath = path.join(
    projectAgentDir(cwd, id),
    "skills",
    `${safeId}.md`,
  );
  try {
    await fs.unlink(filePath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}
