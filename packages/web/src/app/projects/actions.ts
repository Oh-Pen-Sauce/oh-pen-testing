"use server";

import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import {
  addProjectToRegistry,
  defaultClonePath,
  getSecret,
  loadProjectRegistry,
  markProjectFetched,
  parseRepoSlug,
  removeProjectFromRegistry,
  setActiveProject,
  type ManagedProject,
  type ProjectRegistry,
} from "@oh-pen-testing/shared";
import {
  cloneGitHubRepo,
  refreshClone,
  scaffold,
} from "@oh-pen-testing/core";

/**
 * Server actions for the multi-project management flow.
 *
 * All of these operate on the user-scoped registry at
 * ~/.ohpentesting/projects.json and (for clones) the clone
 * directories under ~/.ohpentesting/projects/<owner>/<name>/.
 * None of them touch any one project's config.yml — that lives
 * inside the clone itself and is managed by the existing config
 * loader/saver.
 */

export async function listProjectsAction(): Promise<ProjectRegistry> {
  return await loadProjectRegistry();
}

export interface AddProjectResult {
  ok: boolean;
  project?: ManagedProject;
  detail: string;
}

/**
 * Add a project to the registry + clone it locally if it doesn't
 * exist yet. If `existingLocalPath` is provided, no clone happens
 * and we just register the given path (power-user flow: "I already
 * have this cloned at ~/code/foo, just use it").
 */
export async function addProjectAction(args: {
  slug: string;
  existingLocalPath?: string;
  setActive?: boolean;
}): Promise<AddProjectResult> {
  const parsed = parseRepoSlug(args.slug);
  if (!parsed) {
    return {
      ok: false,
      detail: `"${args.slug}" isn't in owner/name format.`,
    };
  }
  const { owner, name } = parsed;

  // Two paths — existing clone the user tells us about, or fresh
  // clone we manage.
  let localPath: string;
  let detail: string;

  if (args.existingLocalPath) {
    // Validate the path exists and is a git repo. We're trusting
    // the user's origin matches the slug — banner's existing
    // mismatch warning will flag it later if not.
    try {
      await fs.access(`${args.existingLocalPath}/.git`);
    } catch {
      return {
        ok: false,
        detail: `${args.existingLocalPath} doesn't look like a git repo (no .git dir).`,
      };
    }
    localPath = args.existingLocalPath;
    detail = `Registered existing clone at ${localPath}.`;
  } else {
    // Fresh clone using the stored GitHub PAT.
    const tokenResult = await getSecret("github-token");
    const token = tokenResult.value ?? undefined;
    const target = defaultClonePath(owner, name);
    const cloneRes = await cloneGitHubRepo({
      slug: `${owner}/${name}`,
      destDir: target,
      token,
      shallow: true,
    });
    if (!cloneRes.ok) {
      return { ok: false, detail: cloneRes.detail };
    }
    localPath = cloneRes.destDir;
    detail = cloneRes.detail;
  }

  const project = await addProjectToRegistry({
    owner,
    name,
    localPath,
    setActive: args.setActive ?? true,
  });

  // Scaffold a fresh .ohpentesting/ inside the clone so the rest of
  // the app (scanner, setup wizard, etc.) finds a valid config the
  // first time it reads this project. If one already exists we skip.
  try {
    await scaffold({ cwd: localPath });
  } catch {
    /* scaffold is idempotent; failures here don't block registry add */
  }

  revalidatePath("/", "layout");
  return { ok: true, project, detail };
}

export async function switchActiveProjectAction(
  id: string | null,
): Promise<{ ok: boolean; detail: string }> {
  try {
    await setActiveProject(id);
    revalidatePath("/", "layout");
    return {
      ok: true,
      detail: id ? `Switched to ${id}.` : "Cleared active project.",
    };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

export async function removeProjectAction(args: {
  id: string;
  /** When true, also delete the clone on disk. */
  deleteClone?: boolean;
}): Promise<{ ok: boolean; detail: string }> {
  const reg = await loadProjectRegistry();
  const project = reg.projects.find((p) => p.id === args.id);
  if (!project) {
    return { ok: true, detail: "Already removed." };
  }
  await removeProjectFromRegistry(args.id);
  if (args.deleteClone) {
    // Only delete if the clone lives under our managed root — never
    // rm -rf a user-supplied path they registered themselves.
    const managedPrefix = defaultClonePath(project.owner, "");
    if (project.localPath.startsWith(managedPrefix.slice(0, -1))) {
      try {
        await fs.rm(project.localPath, { recursive: true, force: true });
      } catch (err) {
        return {
          ok: false,
          detail: `Removed from registry, but couldn't delete clone: ${(err as Error).message}`,
        };
      }
    }
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    detail: args.deleteClone
      ? `Removed ${args.id} and its clone.`
      : `Removed ${args.id} from registry (clone kept on disk).`,
  };
}

export async function refreshProjectAction(
  id: string,
): Promise<{ ok: boolean; detail: string }> {
  const reg = await loadProjectRegistry();
  const project = reg.projects.find((p) => p.id === id);
  if (!project) {
    return { ok: false, detail: `Project ${id} not registered.` };
  }
  const tokenResult = await getSecret("github-token");
  const token = tokenResult.value ?? undefined;
  const res = await refreshClone(project.id, project.localPath, token);
  if (res.ok) {
    await markProjectFetched(project.id);
    revalidatePath("/", "layout");
  }
  return { ok: res.ok, detail: res.detail };
}
