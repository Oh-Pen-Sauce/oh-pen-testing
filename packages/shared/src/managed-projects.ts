import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

/**
 * Managed-projects registry — the multi-project story for Oh Pen
 * Testing.
 *
 * Without this, Oh Pen Testing scans whatever directory the web
 * server was launched from (cwd). That's fine for "install in one
 * repo, use it there", but breaks the "install once, point it at
 * different GitHub projects" mental model users actually bring.
 *
 * This module adds a lightweight registry:
 *
 *   - Each entry has an owner/name, a local clone path, and a few
 *     bookkeeping fields (last fetched, detected languages, added at).
 *   - One entry is `active` at any given time. The scanner reads from
 *     the active project's localPath instead of cwd.
 *   - Registry file: ~/.ohpentesting/projects.json (user-scoped, 0600)
 *   - Clones land under ~/.ohpentesting/projects/<owner>/<name>/ by
 *     default, but the user can register an existing local clone
 *     anywhere on their filesystem ("I already cloned it to
 *     ~/code/fourfivesixle, just use that").
 *
 * Keeps the legacy cwd mode working: if no project is active, the
 * scanner falls back to cwd/OHPEN_CWD as before. Users who want the
 * "launch from inside the repo" flow don't have to opt in to
 * managed projects.
 */

export const ManagedProjectSchema = z.object({
  /** GitHub owner/name — primary key for the registry. */
  id: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be owner/name"),
  owner: z.string().min(1),
  name: z.string().min(1),
  /** Absolute path to the local clone. */
  localPath: z.string().min(1),
  /**
   * When the clone was last `git pull`ed. null = never since add.
   * Surfaced in the UI so users can see staleness.
   */
  lastFetchedAt: z.string().nullable().default(null),
  /** Detected primary languages, used for playbook filtering. */
  languages: z.array(z.string()).default(["generic"]),
  /** Host (github / gitlab / bitbucket). Only github supported for now. */
  host: z.enum(["github", "gitlab", "bitbucket"]).default("github"),
  addedAt: z.string(),
});
export type ManagedProject = z.infer<typeof ManagedProjectSchema>;

export const ProjectRegistrySchema = z.object({
  version: z.literal(1),
  activeProjectId: z.string().nullable().default(null),
  projects: z.array(ManagedProjectSchema).default([]),
});
export type ProjectRegistry = z.infer<typeof ProjectRegistrySchema>;

function registryDir(): string {
  return path.join(os.homedir(), ".ohpentesting");
}

function registryPath(): string {
  return path.join(registryDir(), "projects.json");
}

/**
 * Default clone location for a new managed project. Under the user's
 * home dir so it's user-scoped and never accidentally inside a repo.
 */
export function defaultClonePath(owner: string, name: string): string {
  return path.join(registryDir(), "projects", owner, name);
}

/**
 * Load the registry. Returns an empty registry on first use / read
 * error — callers don't need to special-case "never opened".
 */
export async function loadProjectRegistry(): Promise<ProjectRegistry> {
  try {
    const raw = await fs.readFile(registryPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return ProjectRegistrySchema.parse(parsed);
  } catch {
    return { version: 1, activeProjectId: null, projects: [] };
  }
}

async function writeProjectRegistry(reg: ProjectRegistry): Promise<void> {
  await fs.mkdir(registryDir(), { recursive: true, mode: 0o700 });
  const tmp = `${registryPath()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(reg, null, 2), {
    mode: 0o600,
    encoding: "utf-8",
  });
  await fs.rename(tmp, registryPath());
  try {
    await fs.chmod(registryPath(), 0o600);
  } catch {
    /* windows — best effort */
  }
}

export interface AddProjectInput {
  owner: string;
  name: string;
  localPath: string;
  languages?: string[];
  host?: "github" | "gitlab" | "bitbucket";
  /** Set to true to also mark this project active on add. */
  setActive?: boolean;
}

/**
 * Register a project. Idempotent: if one with this `owner/name`
 * already exists, its fields are updated and no duplicate is created.
 * Returns the stored record.
 */
export async function addProjectToRegistry(
  input: AddProjectInput,
): Promise<ManagedProject> {
  const reg = await loadProjectRegistry();
  const id = `${input.owner}/${input.name}`;
  const existing = reg.projects.find((p) => p.id === id);
  const record: ManagedProject = {
    id,
    owner: input.owner,
    name: input.name,
    localPath: input.localPath,
    lastFetchedAt: existing?.lastFetchedAt ?? null,
    languages: input.languages ?? existing?.languages ?? ["generic"],
    host: input.host ?? existing?.host ?? "github",
    addedAt: existing?.addedAt ?? new Date().toISOString(),
  };
  const projects = existing
    ? reg.projects.map((p) => (p.id === id ? record : p))
    : [...reg.projects, record];
  await writeProjectRegistry({
    ...reg,
    projects,
    activeProjectId: input.setActive ? id : reg.activeProjectId,
  });
  return record;
}

/**
 * Mark a project active. The scanner reads from its localPath on
 * the next run. Throws if the id isn't registered.
 */
export async function setActiveProject(id: string | null): Promise<void> {
  const reg = await loadProjectRegistry();
  if (id !== null && !reg.projects.some((p) => p.id === id)) {
    throw new Error(`Project '${id}' is not in the registry.`);
  }
  await writeProjectRegistry({ ...reg, activeProjectId: id });
}

/**
 * Remove a project entry (registry only — does NOT delete the
 * clone on disk). Callers that want to delete the clone too should
 * do so themselves with a separate fs.rm().
 */
export async function removeProjectFromRegistry(id: string): Promise<void> {
  const reg = await loadProjectRegistry();
  const projects = reg.projects.filter((p) => p.id !== id);
  const activeProjectId =
    reg.activeProjectId === id ? null : reg.activeProjectId;
  await writeProjectRegistry({ ...reg, projects, activeProjectId });
}

/**
 * Update lastFetchedAt for a project — called after a git pull
 * succeeds.
 */
export async function markProjectFetched(id: string): Promise<void> {
  const reg = await loadProjectRegistry();
  const projects = reg.projects.map((p) =>
    p.id === id ? { ...p, lastFetchedAt: new Date().toISOString() } : p,
  );
  await writeProjectRegistry({ ...reg, projects });
}

/**
 * Resolve the scan target: the active managed project's localPath
 * if set, otherwise null (caller falls back to cwd).
 */
export async function getActiveProjectPath(): Promise<string | null> {
  const reg = await loadProjectRegistry();
  if (!reg.activeProjectId) return null;
  const active = reg.projects.find((p) => p.id === reg.activeProjectId);
  return active?.localPath ?? null;
}

export function parseRepoSlug(
  slug: string,
): { owner: string; name: string } | null {
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(slug);
  if (!m) return null;
  return { owner: m[1]!, name: m[2]! };
}
