import fs from "node:fs/promises";
import path from "node:path";
import { getOhpenCwd } from "../../lib/ohpen-cwd";
import { safeLoadConfig } from "../../lib/repo";

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
  const cwd = getOhpenCwd();
  const config = await safeLoadConfig();
  const gitRepo = config?.git.repo ?? null;

  const isOhpenSource = await detectOhpenSource(cwd);
  const cwdTail = path.basename(cwd);
  const repoName = gitRepo ? gitRepo.split("/")[1] : null;
  const nameMismatch =
    gitRepo && repoName && repoName !== "name" && !cwdMatchesRepo(cwdTail, repoName);

  // Tier the banner colour by severity.
  const level: "neutral" | "warn" | "danger" = isOhpenSource
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
      {level === "danger" && (
        <span
          className="text-[11.5px] font-semibold flex items-center gap-1.5"
          style={{ color: "var(--sauce-dark)" }}
        >
          ⚠ This is the Oh Pen Testing source repo — findings will mostly
          be its own deliberately-vulnerable test fixtures. To scan a real
          project, relaunch from that project&rsquo;s directory.
        </span>
      )}
      {level === "warn" && !isOhpenSource && (
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
