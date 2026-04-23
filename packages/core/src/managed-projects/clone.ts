import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * git clone helper for managed projects.
 *
 * Uses a user-supplied token (their GitHub PAT) injected into the
 * clone URL. We do NOT write the token to the cloned repo's git
 * config afterwards — `git pull` inside the clone will need auth
 * again, which we'll add when the refresh feature lands. For now,
 * the clone itself auths via embedded URL and that's it.
 *
 * Shallow (`--depth=1`) by default because Oh Pen Testing only
 * cares about the tip commit's file tree + last blame line. Users
 * who want full history can pass `shallow: false`.
 */

export interface CloneOptions {
  /** owner/name slug. */
  slug: string;
  /** Absolute destination path. Parent will be created. */
  destDir: string;
  /** GitHub PAT. Optional for public repos; required for private. */
  token?: string;
  /** Default true. */
  shallow?: boolean;
  /** Host — only 'github' supported right now. */
  host?: "github" | "gitlab" | "bitbucket";
  /** Timeout in ms — default 5 minutes. */
  timeoutMs?: number;
}

export interface CloneResult {
  ok: boolean;
  destDir: string;
  detail: string;
}

export async function cloneGitHubRepo(
  opts: CloneOptions,
): Promise<CloneResult> {
  const { slug, destDir, token, shallow = true, host = "github" } = opts;
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;

  if (host !== "github") {
    return {
      ok: false,
      destDir,
      detail: `Host '${host}' not yet supported for managed clones.`,
    };
  }

  // Bail if the dest already exists AND looks like a git repo — the
  // user probably added an existing clone via "I already cloned it,
  // just use this path". Don't clobber their work.
  try {
    await fs.access(path.join(destDir, ".git"));
    return {
      ok: true,
      destDir,
      detail: `Reusing existing clone at ${destDir} (already a git repo).`,
    };
  } catch {
    /* doesn't exist or isn't a git repo — proceed with clone */
  }

  await fs.mkdir(path.dirname(destDir), { recursive: true });

  // Compose the auth URL. Never log it — it contains the token.
  // Use `x-access-token:` as the username, which GitHub accepts for
  // any token type (classic or fine-grained).
  const baseUrl = token
    ? `https://x-access-token:${token}@github.com/${slug}.git`
    : `https://github.com/${slug}.git`;

  const args = [
    "clone",
    ...(shallow ? ["--depth=1", "--single-branch"] : []),
    "--",
    baseUrl,
    destDir,
  ];

  const result = await runGit(args, timeoutMs);
  if (!result.ok) {
    // Scrub the token from any error output before surfacing.
    const safe = token
      ? result.detail.replace(new RegExp(token, "g"), "***")
      : result.detail;
    return {
      ok: false,
      destDir,
      detail: `git clone failed: ${safe}`,
    };
  }

  // Rewrite origin URL to remove the token — leaving it means the
  // token ends up in the clone's .git/config on disk, which is
  // exactly the kind of long-lived plaintext secret we're trying to
  // avoid. Future `git pull` calls from the app will re-inject via
  // a credential helper or a fresh URL.
  if (token) {
    const cleanUrl = `https://github.com/${slug}.git`;
    await runGit(["-C", destDir, "remote", "set-url", "origin", cleanUrl], 15_000);
  }

  return {
    ok: true,
    destDir,
    detail: `Cloned ${slug} to ${destDir}${shallow ? " (shallow)" : ""}.`,
  };
}

/**
 * Update a previously-cloned managed project. Uses the PAT to
 * auth a one-shot fetch without leaving the token in .git/config.
 */
export async function refreshClone(
  slug: string,
  destDir: string,
  token?: string,
): Promise<CloneResult> {
  // Sanity check — is this actually a git repo?
  try {
    await fs.access(path.join(destDir, ".git"));
  } catch {
    return {
      ok: false,
      destDir,
      detail: `${destDir} isn't a git repo — re-add the project.`,
    };
  }

  const url = token
    ? `https://x-access-token:${token}@github.com/${slug}.git`
    : `https://github.com/${slug}.git`;

  const fetched = await runGit(
    ["-C", destDir, "fetch", "--depth=1", url, "HEAD"],
    2 * 60 * 1000,
  );
  if (!fetched.ok) {
    const safe = token
      ? fetched.detail.replace(new RegExp(token, "g"), "***")
      : fetched.detail;
    return { ok: false, destDir, detail: `git fetch failed: ${safe}` };
  }

  // Hard-reset to FETCH_HEAD so any local edits to the clone get
  // wiped — the clone is disposable by design.
  const reset = await runGit(
    ["-C", destDir, "reset", "--hard", "FETCH_HEAD"],
    15_000,
  );
  if (!reset.ok) {
    return { ok: false, destDir, detail: `git reset failed: ${reset.detail}` };
  }

  return {
    ok: true,
    destDir,
    detail: `Refreshed ${slug} from origin.`,
  };
}

interface RunResult {
  ok: boolean;
  detail: string;
}

function runGit(args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    let stderr = "";
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, detail: `git timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, detail: stdout.trim() || "ok" });
      } else {
        resolve({
          ok: false,
          detail: (stderr.trim() || stdout.trim() || `exit ${code}`).slice(
            0,
            2000,
          ),
        });
      }
    });
  });
}
