/**
 * Pre-flight ("taste test") for the GitHub remediation pipeline.
 *
 * Runs through the same chain real remediations use, in order, but
 * stops short of actually committing or opening a PR. Each step
 * passes with a green tick or fails with the verbatim error so the
 * user knows EXACTLY which credential / permission is missing
 * before they kick off a real scan.
 *
 * Tested:
 *   1. Token validity         — GET /user with the token
 *   2. Repo accessible        — GET /repos/{owner}/{repo}
 *   3. Push permission        — git push --dry-run via token URL
 *   4. PR-create permission   — repo permissions includes "push"
 *
 * Step 3 uses --dry-run so nothing actually lands on the remote.
 * That's load-bearing: dry-run still does the auth handshake, so
 * if the token can't push, we'll see "remote: Permission denied"
 * exactly as the real push would. No remote refs are created.
 */
import { Octokit } from "@octokit/rest";
import { simpleGit } from "simple-git";
import { parseGitHubRepo } from "./pr.js";

export interface PreflightStep {
  /** Human-readable label, e.g. "GitHub token". */
  name: string;
  status: "ok" | "fail";
  /** Short success or failure detail. */
  detail: string;
}

export interface PreflightResult {
  /** Overall: true iff EVERY step passed. */
  ok: boolean;
  steps: PreflightStep[];
  /** Echoed back so the UI can show "tested as user X". */
  authenticatedAs: string | null;
}

export interface PreflightInput {
  /** The token from the secrets store / env. */
  token: string;
  /** The owner/name slug from config.git.repo. */
  repo: string;
  /** The local clone path — needed for git push --dry-run. */
  repoPath: string;
}

/**
 * Strip token from any URL in `s` so error messages we surface
 * never leak it. Same defence as the runtime adapter.
 */
function redactToken(s: string): string {
  return s.replace(/x-access-token:[^@\s]+@/gi, "x-access-token:***@");
}

export async function pingGitHub(
  input: PreflightInput,
): Promise<PreflightResult> {
  const steps: PreflightStep[] = [];
  let authenticatedAs: string | null = null;

  // Defend against malformed slugs early so step 2 doesn't throw.
  let owner: string;
  let repoName: string;
  try {
    const parsed = parseGitHubRepo(input.repo);
    owner = parsed.owner;
    repoName = parsed.repo;
  } catch (err) {
    return {
      ok: false,
      authenticatedAs: null,
      steps: [
        {
          name: "Repo slug",
          status: "fail",
          detail: `${(err as Error).message}. Expected owner/name like 'snrefertech/fourfivesixle'.`,
        },
      ],
    };
  }

  const octokit = new Octokit({ auth: input.token });

  // Step 1 — token validity. GET /user is the cheapest call that
  // proves the token is well-formed AND not revoked.
  try {
    const me = await octokit.users.getAuthenticated();
    authenticatedAs = me.data.login;
    steps.push({
      name: "GitHub token",
      status: "ok",
      detail: `Authenticated as ${me.data.login}.`,
    });
  } catch (err) {
    const msg = (err as Error).message;
    steps.push({
      name: "GitHub token",
      status: "fail",
      detail: `Token rejected by GitHub: ${msg}. Generate a fresh PAT in GitHub → Settings → Developer settings, with at least 'repo' or 'Contents: write' scope, and re-run setup.`,
    });
    return { ok: false, authenticatedAs, steps };
  }

  // Step 2 — repo accessible to this token. 404 here usually means
  // either the repo really doesn't exist OR the token can't see
  // private repos (GitHub returns 404 not 403 for security).
  try {
    const repoInfo = await octokit.repos.get({ owner, repo: repoName });
    const perm = (repoInfo.data.permissions ?? {}) as Record<
      string,
      boolean | undefined
    >;
    const canPush = Boolean(perm.push) || Boolean(perm.maintain) || Boolean(perm.admin);
    steps.push({
      name: "Repo access",
      status: "ok",
      detail: `Repo ${owner}/${repoName} accessible. Push permission: ${canPush ? "yes" : "NO — read-only"}.`,
    });
    if (!canPush) {
      steps.push({
        name: "Push permission",
        status: "fail",
        detail: `Token can read this repo but not push. Either widen the token's scope (classic PAT: 'repo'; fine-grained: 'Contents: write') or pick a repo you own.`,
      });
      return { ok: false, authenticatedAs, steps };
    }
  } catch (err) {
    const msg = (err as Error).message;
    const hint = msg.includes("Not Found")
      ? `repo ${owner}/${repoName} not found OR not visible to this token. If it's private, the token needs 'repo' scope (classic) or explicit access (fine-grained).`
      : msg;
    steps.push({
      name: "Repo access",
      status: "fail",
      detail: `${hint}`,
    });
    return { ok: false, authenticatedAs, steps };
  }

  // Step 3 — git push --dry-run with the same token-embedded URL
  // remediation will use. Proves the local clone can actually push
  // BEFORE we try to land 21 patches and watch them all fail.
  // --dry-run still does auth handshake server-side; the remote
  // ref isn't created.
  const pushUrl = `https://x-access-token:${input.token}@github.com/${owner}/${repoName}.git`;
  try {
    const git = simpleGit(input.repoPath);
    // Push HEAD to a dryrun ref. The ref name doesn't matter — it's
    // dry-run — but we use a unique-looking one so any (very
    // unlikely) accidental real push wouldn't clobber a real branch.
    await git.push(pushUrl, "HEAD:refs/heads/__ohpen_preflight__", [
      "--dry-run",
    ]);
    steps.push({
      name: "Git push (dry-run)",
      status: "ok",
      detail: "Push auth handshake succeeded. Real PRs will land cleanly.",
    });
  } catch (err) {
    const msg = redactToken((err as Error).message);
    steps.push({
      name: "Git push (dry-run)",
      status: "fail",
      detail: `Dry-run push failed: ${msg}. Most often this means the local clone path '${input.repoPath}' isn't a git repo, has no commits to push, or the branch protection on the remote rejects pushes from the authenticated user.`,
    });
    return { ok: false, authenticatedAs, steps };
  }

  return { ok: true, authenticatedAs, steps };
}
