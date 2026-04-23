import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolveScanTargetPath } from "../../lib/ohpen-cwd";
import { safeLoadConfig } from "../../lib/repo";
import { AlignRepoButton } from "./align-repo-button";

const execAsync = promisify(exec);

/**
 * Server component banner — sits under the sidebar's brand block and
 * above every page's content, making the one thing everyone gets
 * wrong at first brutally obvious: **which directory is actually
 * being scanned**.
 *
 * Oh Pen Testing is a local tool. The `git.repo` setting in config
 * is only used for *opening PRs* — the scan target is whatever
 * directory the web server was launched from (OHPEN_CWD env var, or
 * process.cwd()). Multiple users have been surprised that connecting
 * their GitHub repo in the setup wizard doesn't magically clone and
 * scan it; they're confused because their cwd ends up being the
 * oh-pen-testing source itself (when running `pnpm dev` from there).
 *
 * The banner:
 *   - Shows the scan target path in monospace
 *   - Shows the configured git.repo
 *   - If the cwd looks like the oh-pen-testing source repo (has
 *     `packages/core/src/playbook-runner/` at root), flags a red
 *     warning explaining why findings look weird
 *   - If the cwd's folder name doesn't look related to the git.repo
 *     slug, shows an amber nudge ("This doesn't match your repo —
 *     make sure you launched from the right project")
 */
export async function ScanTargetBanner() {
  // This component is rendered in the root layout — anything it throws
  // would 500 every page, including /setup, making the tool unopenable.
  // Wrap in try/catch and degrade to a minimal neutral banner on any
  // failure. Worst case: we lose the warning nuance; never worse than
  // a white-screen-of-death.
  try {
    return await renderBanner();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[scan-target-banner] render failed, showing minimal fallback:",
      (err as Error).message,
    );
    return (
      <div
        className="px-5 py-2.5 text-[11.5px]"
        style={{
          background: "var(--cream-soft)",
          borderBottom: "2px solid var(--ink)",
          fontFamily: "var(--font-mono)",
          color: "var(--ink-soft)",
        }}
      >
        <code>{process.env.OHPEN_CWD ?? process.cwd()}</code>
      </div>
    );
  }
}

async function renderBanner() {
  const cwd = await resolveScanTargetPath();
  const config = await safeLoadConfig();
  const gitRepo = config?.git.repo ?? null;

  // "Setup still in progress" means either no config exists yet, or
  // the user hasn't picked a real GitHub repo (git.repo still at the
  // placeholder "owner/name"), or they haven't acknowledged
  // authorisation. Before any of those are done, showing a red
  // "PR target doesn't match scan folder's origin" warning is
  // nonsense — the user hasn't committed to a PR target yet. Show a
  // gentle "setup in progress" line instead, so the banner stays
  // informative without being alarmist.
  const setupIncomplete =
    !config ||
    !gitRepo ||
    gitRepo === "owner/name" ||
    !config.scope?.authorisation_acknowledged;

  const isOhpenSource = await detectOhpenSource(cwd);
  const cwdTail = path.basename(cwd);

  // Look at the cwd's real git origin. This is what `git remote
  // get-url origin` reports — parse it into owner/name so we can
  // compare directly against config.git.repo. A mismatch here is
  // worse than a folder-name mismatch (which is just a heuristic)
  // because it's authoritative: "the repo you're in is NOT the
  // repo PRs will open against".
  const cwdOrigin = await detectCwdOrigin(cwd);

  const originMismatch =
    !setupIncomplete &&
    gitRepo &&
    gitRepo !== "owner/name" &&
    cwdOrigin &&
    cwdOrigin.toLowerCase() !== gitRepo.toLowerCase();

  const repoName = gitRepo ? gitRepo.split("/")[1] : null;
  const nameMismatch =
    !setupIncomplete &&
    gitRepo &&
    repoName &&
    repoName !== "name" &&
    !cwdMatchesRepo(cwdTail, repoName);

  // Tier the banner colour by severity. Setup-incomplete is always
  // neutral — we're not going to alarm the user about a mismatch
  // before they've had a chance to declare what they want.
  const level: "neutral" | "warn" | "danger" = setupIncomplete
    ? "neutral"
    : isOhpenSource
      ? "danger"
      : originMismatch
        ? "danger"
        : nameMismatch
          ? "warn"
          : "neutral";

  const bg =
    level === "danger"
      ? "#FBE4E0"
      : level === "warn"
        ? "var(--parmesan)"
        : "var(--cream-soft)";
  const borderColor =
    level === "danger"
      ? "var(--sauce)"
      : level === "warn"
        ? "var(--ink)"
        : "var(--ink)";

  return (
    <div
      className="px-5 py-2.5 text-[11.5px] flex flex-wrap items-center gap-x-5 gap-y-1"
      style={{
        background: bg,
        borderBottom: `2px solid ${borderColor}`,
        fontFamily: "var(--font-mono)",
      }}
    >
      <span>
        <span
          className="text-[9px] font-bold tracking-[0.15em] uppercase mr-1.5"
          style={{ color: "var(--ink-soft)" }}
        >
          scan target
        </span>
        <code>{cwd}</code>
      </span>
      {gitRepo && gitRepo !== "owner/name" && (
        <span>
          <span
            className="text-[9px] font-bold tracking-[0.15em] uppercase mr-1.5"
            style={{ color: "var(--ink-soft)" }}
          >
            prs go to
          </span>
          <code>{gitRepo}</code>
        </span>
      )}
      {setupIncomplete && (
        <span
          className="text-[11.5px]"
          style={{ color: "var(--ink-soft)" }}
        >
          setup in progress — scan target will lock in once you finish
          the wizard
        </span>
      )}
      {!setupIncomplete && isOhpenSource && (
        <span
          className="text-[11.5px] font-semibold flex items-center gap-1.5"
          style={{ color: "var(--sauce-dark)" }}
        >
          ⚠ This is the Oh Pen Testing source repo — findings will mostly
          be its own deliberately-vulnerable test fixtures. To scan a real
          project, relaunch from that project&rsquo;s directory.
        </span>
      )}
      {!setupIncomplete && !isOhpenSource && originMismatch && (
        <span
          className="text-[11.5px] font-semibold flex items-center flex-wrap gap-y-1"
          style={{ color: "var(--sauce-dark)" }}
        >
          ⚠ PR target <code className="mx-1">{gitRepo}</code> doesn&rsquo;t
          match the scan folder&rsquo;s git origin (
          <code className="mx-1">{cwdOrigin}</code>
          ). PRs would land on the wrong repo.
          {cwdOrigin && <AlignRepoButton detectedRepo={cwdOrigin} />}
        </span>
      )}
      {!setupIncomplete && !isOhpenSource && !originMismatch && nameMismatch && (
        <span
          className="text-[11.5px]"
          style={{ color: "var(--ink)" }}
        >
          ⚠ Folder name <code>{cwdTail}</code> doesn&rsquo;t obviously match{" "}
          <code>{gitRepo}</code>. If that&rsquo;s wrong, stop the server and
          relaunch from the project you meant to scan.
        </span>
      )}
    </div>
  );
}

/**
 * Read `git remote get-url origin` in the scan target and parse it into
 * owner/name. Returns null if the dir isn't a git repo, has no origin,
 * or the remote URL doesn't parse as a GitHub-style slug.
 */
async function detectCwdOrigin(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git -C "${cwd}" remote get-url origin`,
      { timeout: 3000 },
    );
    const url = stdout.trim();
    if (!url) return null;
    // https://github.com/owner/name(.git)?
    const https =
      /^https?:\/\/[^/]+\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(url);
    if (https) return https[1]!;
    // git@github.com:owner/name(.git)?
    const ssh = /^git@[^:]+:([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(url);
    if (ssh) return ssh[1]!;
    // ssh://git@host/owner/name(.git)?
    const sshUrl = /^ssh:\/\/git@[^/]+\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(
      url,
    );
    if (sshUrl) return sshUrl[1]!;
    return null;
  } catch {
    return null;
  }
}

/**
 * Cheap structural check — does `cwd` look like the Oh Pen Testing
 * source tree itself? The unambiguous tell is packages/core/src/
 * playbook-runner/manifest.ts + packages/shared/src/setup-assistant/.
 */
async function detectOhpenSource(cwd: string): Promise<boolean> {
  const markers = [
    path.join(cwd, "packages", "core", "src", "playbook-runner", "manifest.ts"),
    path.join(
      cwd,
      "packages",
      "shared",
      "src",
      "setup-assistant",
      "assets",
      "memory.md",
    ),
  ];
  for (const m of markers) {
    try {
      await fs.access(m);
      return true;
    } catch {
      /* not this marker */
    }
  }
  return false;
}

/**
 * Loose match heuristic — does the directory name look related to
 * the configured repo slug? Exact substring either direction, or a
 * kebab-case root match.
 */
function cwdMatchesRepo(cwdTail: string, repoName: string): boolean {
  const a = cwdTail.toLowerCase();
  const b = repoName.toLowerCase();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Allow for common suffixes like `-main`, `-prod`, `-dev`.
  const stripped = a.replace(/-(main|prod|dev|staging|worktree)$/, "");
  if (stripped === b) return true;
  return false;
}
