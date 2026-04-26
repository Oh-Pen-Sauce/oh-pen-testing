"use server";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  loadConfig,
  ConfigSchema,
  writeConfig,
  ohpenPaths,
  type AutonomyMode,
  type ProviderId,
} from "@oh-pen-testing/shared";
import {
  pingGitHub,
  resolveGitHubToken,
  type PreflightResult,
} from "@oh-pen-testing/git-github";
import { resolveScanTargetPath } from "../../lib/ohpen-cwd";

/**
 * Pre-flight ("taste test") for the GitHub remediation pipeline.
 * Verifies token + repo access + push permission BEFORE the user
 * runs a real scan and watches 21 patches fail. Surfaces a step-by-
 * step report the UI can render as ticks/crosses.
 */
export async function pingGitHubAction(): Promise<PreflightResult> {
  const cwd = await resolveScanTargetPath();
  const config = await loadConfig(cwd);
  const token = await resolveGitHubToken();
  if (!token) {
    return {
      ok: false,
      authenticatedAs: null,
      steps: [
        {
          name: "GitHub token",
          status: "fail",
          detail:
            "No token found. Finish the wizard's GitHub step (or export GITHUB_TOKEN in the shell before launching) so we can authenticate.",
        },
      ],
    };
  }
  if (!config.git.repo || config.git.repo === "owner/name") {
    return {
      ok: false,
      authenticatedAs: null,
      steps: [
        {
          name: "Repo target",
          status: "fail",
          detail:
            "PR target repo not set (still 'owner/name'). Finish the GitHub step in /setup so we know where to test pushes.",
        },
      ],
    };
  }
  return pingGitHub({
    token,
    repo: config.git.repo,
    repoPath: cwd,
  });
}

export interface SettingsPatch {
  autonomy: AutonomyMode;
  parallelism: number;
  provider: ProviderId;
  model: string;
  budgetUsd: number;
  /** Nonna's review pass — head-chef quality gate before commit. */
  reviewEnabled: boolean;
}

export async function saveSettingsAction(patch: SettingsPatch): Promise<void> {
  const cwd = await resolveScanTargetPath();
  const current = await loadConfig(cwd);
  current.agents.autonomy = patch.autonomy;
  current.agents.parallelism = patch.parallelism;
  // Defensive: older configs may not have the review object yet (it
  // was added later) — initialise if missing.
  current.agents.review = { enabled: patch.reviewEnabled };
  current.ai.primary_provider = patch.provider;
  current.ai.model = patch.model;
  current.ai.rate_limit.budget_usd = patch.budgetUsd;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/settings");
  revalidatePath("/");
}

/**
 * Persist the risky-test toggle map. Lives in `scans.risky`. These are
 * state-mutating / side-effect-inducing tests so they're off by default
 * and gated behind an Advanced toggle in the UI.
 */
export async function saveRiskyAction(
  risky: Record<string, boolean>,
): Promise<void> {
  const cwd = await resolveScanTargetPath();
  const current = await loadConfig(cwd);
  current.scans.risky = risky;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/settings");
  revalidatePath("/");
}

export interface ResetOptions {
  /** Wipe config.yml → re-run setup wizard. Always true. */
  resetConfig: boolean;
  /** Wipe .ohpentesting/issues + scans + logs + reports. */
  wipeHistory: boolean;
  /** Wipe ~/.ohpentesting/secrets.json (API keys, GitHub PAT). */
  wipeSecrets: boolean;
  /** Wipe ~/.ohpentesting/projects.json (managed projects). */
  wipeProjects: boolean;
  /**
   * Also rm -rf ~/.ohpentesting/projects/<owner>/<repo>/ for every
   * cloned project. Strictly more destructive than wipeProjects
   * (which only deletes the registry JSON). Useful when a clone has
   * picked up dirty git state from prior failed runs and you'd
   * rather start fresh than `git reset --hard` it manually.
   * Implies wipeProjects.
   */
  wipeClones: boolean;
}

export interface ResetResult {
  ok: boolean;
  detail: string;
  wiped: string[];
}

/**
 * Beta-only "start from scratch" reset. Lets a tester re-run the
 * whole setup flow without hand-editing files.
 *
 * The user gets a dialog with checkboxes for each category so they
 * can keep some state (e.g. "wipe config but keep my GitHub PAT")
 * between runs if it speeds up their testing loop.
 *
 * This is the raw data side. The UI must also clear the chat
 * sessionStorage snapshot client-side — do that in the same
 * click handler, not here (server actions can't touch browser
 * storage). On success the UI redirects to /setup.
 */
export async function resetEverythingAction(
  opts: ResetOptions,
): Promise<ResetResult> {
  const wiped: string[] = [];
  const cwd = await resolveScanTargetPath();
  const paths = ohpenPaths(cwd);

  if (opts.resetConfig) {
    // Delete the config file outright — loadConfig throws on missing,
    // which triggers setup's "no config" path and shows the wizard.
    try {
      await fs.unlink(paths.config);
      wiped.push(`config.yml (at ${paths.config})`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        return {
          ok: false,
          detail: `Couldn't delete config.yml: ${(err as Error).message}`,
          wiped,
        };
      }
    }
  }

  if (opts.wipeHistory) {
    for (const dir of [paths.issues, paths.scans, paths.logs, paths.reports]) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
        await fs.mkdir(dir, { recursive: true });
        wiped.push(`${path.relative(cwd, dir)}/`);
      } catch {
        /* best effort — skip */
      }
    }
  }

  if (opts.wipeSecrets) {
    const secretsPath = path.join(
      os.homedir(),
      ".ohpentesting",
      "secrets.json",
    );
    try {
      await fs.unlink(secretsPath);
      wiped.push(`~/.ohpentesting/secrets.json`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        return {
          ok: false,
          detail: `Couldn't delete secrets: ${(err as Error).message}`,
          wiped,
        };
      }
    }
    // Also best-effort nuke the OS keychain entries. We can only
    // clear via keytar if it loads — on platforms where it doesn't,
    // the file deletion above covers us anyway.
    try {
      const dynamicImport = new Function(
        "m",
        "return import(m)",
      ) as (m: string) => Promise<{
        default: {
          deletePassword(s: string, a: string): Promise<boolean>;
        };
      }>;
      const mod = await dynamicImport("keytar");
      for (const account of [
        "anthropic-api-key",
        "openai-api-key",
        "openrouter-api-key",
        "github-token",
        "gitlab-token",
        "bitbucket-token",
      ]) {
        try {
          await mod.default.deletePassword("oh-pen-testing", account);
        } catch {
          /* skip */
        }
      }
      wiped.push("OS keychain entries (best effort)");
    } catch {
      /* keytar not available — file deletion is the tier we care about */
    }
  }

  if (opts.wipeProjects) {
    const projectsPath = path.join(
      os.homedir(),
      ".ohpentesting",
      "projects.json",
    );
    try {
      await fs.unlink(projectsPath);
      wiped.push(`~/.ohpentesting/projects.json`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        return {
          ok: false,
          detail: `Couldn't delete projects registry: ${(err as Error).message}`,
          wiped,
        };
      }
    }
    // The clones themselves stay on disk unless wipeClones is also
    // set — see below. wipeProjects on its own only deletes the
    // registry JSON, leaving the clones recoverable.
  }

  if (opts.wipeClones) {
    // Nuke every clone Oh Pen Testing has created in
    // ~/.ohpentesting/projects/. Only the structured "owner/repo"
    // directory layout is touched — top-level dotfiles or
    // unrelated content survives.
    //
    // This is the heaviest reset option. Recommended when prior
    // remediation runs left a clone with dirty git state that's
    // tripping up new agent runs ("Your local changes would be
    // overwritten by checkout"). After this, re-running setup
    // re-clones cleanly.
    const projectsRoot = path.join(
      os.homedir(),
      ".ohpentesting",
      "projects",
    );
    try {
      const owners = await fs.readdir(projectsRoot, { withFileTypes: true });
      for (const ownerEntry of owners) {
        if (!ownerEntry.isDirectory()) continue;
        const ownerDir = path.join(projectsRoot, ownerEntry.name);
        const repos = await fs.readdir(ownerDir, { withFileTypes: true });
        for (const repoEntry of repos) {
          if (!repoEntry.isDirectory()) continue;
          const repoDir = path.join(ownerDir, repoEntry.name);
          try {
            await fs.rm(repoDir, { recursive: true, force: true });
            wiped.push(`~/.ohpentesting/projects/${ownerEntry.name}/${repoEntry.name}/`);
          } catch {
            /* skip individual failures, keep going */
          }
        }
        // Try to remove the (possibly now-empty) owner dir too. If
        // it has other content (other repos that failed to delete),
        // rmdir errors out and we leave it alone.
        try {
          await fs.rmdir(ownerDir);
        } catch {
          /* not empty or permission denied — fine */
        }
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        return {
          ok: false,
          detail: `Couldn't enumerate clones to wipe: ${(err as Error).message}`,
          wiped,
        };
      }
      // ENOENT = no projects dir, nothing to wipe — that's fine.
    }
  }

  // Broad revalidation so banner / sidebar / every page drops cached
  // state that referenced the now-deleted config.
  revalidatePath("/", "layout");

  return {
    ok: true,
    detail:
      wiped.length === 0
        ? "Nothing was wiped (all options off)."
        : `Reset complete. Wiped: ${wiped.join(", ")}.`,
    wiped,
  };
}
