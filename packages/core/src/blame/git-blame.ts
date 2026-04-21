import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface BlameLineInfo {
  line: number;
  commitSha: string;
  author: string;
  authorEmail: string;
  authorTimeUnix: number;
  authorTimeIso: string;
  summary: string;
}

export interface BlameRangeSummary {
  file: string;
  startLine: number;
  endLine: number;
  oldestCommit: BlameLineInfo | null;
  newestCommit: BlameLineInfo | null;
  uniqueAuthors: string[];
  ageDays: number | null;
  /** Per-line detail. May be empty if the file isn't tracked. */
  lines: BlameLineInfo[];
}

/**
 * Produce a blame summary for a file range — primarily used to answer
 * "how long has this bug been here?"
 *
 * Shells out to `git blame --porcelain -L <start>,<end>` and parses the
 * output. If the file is untracked or the range is invalid, returns a
 * summary with `oldestCommit: null` and empty lines array — the caller
 * should not assume blame data is always available.
 */
export async function runGitBlame(
  repoPath: string,
  file: string,
  startLine: number,
  endLine: number,
): Promise<BlameRangeSummary> {
  const result: BlameRangeSummary = {
    file,
    startLine,
    endLine,
    oldestCommit: null,
    newestCommit: null,
    uniqueAuthors: [],
    ageDays: null,
    lines: [],
  };

  try {
    const { stdout } = await exec(
      "git",
      [
        "blame",
        "--porcelain",
        "-L",
        `${startLine},${endLine}`,
        "--",
        file,
      ],
      {
        cwd: repoPath,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    result.lines = parsePorcelain(stdout, startLine);
  } catch {
    return result;
  }

  if (result.lines.length === 0) return result;

  // Oldest / newest
  const sortedByTime = [...result.lines].sort(
    (a, b) => a.authorTimeUnix - b.authorTimeUnix,
  );
  result.oldestCommit = sortedByTime[0] ?? null;
  result.newestCommit = sortedByTime[sortedByTime.length - 1] ?? null;

  // Unique authors
  const authors = new Set(result.lines.map((l) => l.author));
  result.uniqueAuthors = Array.from(authors);

  // Age of oldest commit in days
  if (result.oldestCommit) {
    const now = Math.floor(Date.now() / 1000);
    result.ageDays = Math.floor(
      (now - result.oldestCommit.authorTimeUnix) / 86400,
    );
  }

  return result;
}

/**
 * Parses git blame --porcelain output. Format:
 *   <40-char sha> <orig-line> <final-line> <group-size>
 *   author Name
 *   author-mail <email>
 *   author-time 1234567890
 *   author-tz +0000
 *   committer …
 *   summary First line of commit message
 *   <other keys>
 *   \t<source code line>
 * Subsequent lines for the same commit omit most headers.
 */
function parsePorcelain(
  raw: string,
  startLine: number,
): BlameLineInfo[] {
  const out: BlameLineInfo[] = [];
  const lines = raw.split("\n");
  const commitCache = new Map<
    string,
    Omit<BlameLineInfo, "line">
  >();

  let currentCommit: string | null = null;
  let currentFinalLine: number | null = null;
  let pendingHeader: Partial<BlameLineInfo> & { sha?: string } = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^[0-9a-f]{40}\s/.test(line)) {
      const parts = line.split(" ");
      const sha = parts[0]!;
      const finalLine = Number(parts[2]);
      currentCommit = sha;
      currentFinalLine = finalLine;
      pendingHeader = { sha };
      continue;
    }
    if (line.startsWith("author ")) {
      pendingHeader.author = line.slice("author ".length);
    } else if (line.startsWith("author-mail ")) {
      pendingHeader.authorEmail = line
        .slice("author-mail ".length)
        .replace(/^<|>$/g, "");
    } else if (line.startsWith("author-time ")) {
      pendingHeader.authorTimeUnix = Number(
        line.slice("author-time ".length),
      );
      pendingHeader.authorTimeIso = new Date(
        pendingHeader.authorTimeUnix * 1000,
      ).toISOString();
    } else if (line.startsWith("summary ")) {
      pendingHeader.summary = line.slice("summary ".length);
    } else if (line.startsWith("\t")) {
      // Source line — emit a BlameLineInfo
      if (currentCommit && currentFinalLine !== null) {
        const cached = commitCache.get(currentCommit);
        const merged: Omit<BlameLineInfo, "line"> = {
          commitSha: currentCommit,
          author: pendingHeader.author ?? cached?.author ?? "unknown",
          authorEmail:
            pendingHeader.authorEmail ?? cached?.authorEmail ?? "",
          authorTimeUnix:
            pendingHeader.authorTimeUnix ?? cached?.authorTimeUnix ?? 0,
          authorTimeIso:
            pendingHeader.authorTimeIso ??
            cached?.authorTimeIso ??
            new Date(0).toISOString(),
          summary: pendingHeader.summary ?? cached?.summary ?? "",
        };
        commitCache.set(currentCommit, merged);
        out.push({ line: currentFinalLine, ...merged });
        pendingHeader = {};
      }
    }
  }

  // Sort by original line number for stability
  out.sort((a, b) => a.line - b.line);
  return out;
}

/**
 * Format an age into a human string: "7 years ago", "3 months ago", "yesterday".
 */
export function formatAge(ageDays: number | null): string {
  if (ageDays === null) return "unknown";
  if (ageDays < 1) return "today";
  if (ageDays < 2) return "yesterday";
  if (ageDays < 30) return `${ageDays} day${ageDays === 1 ? "" : "s"} ago`;
  const months = Math.floor(ageDays / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(ageDays / 365);
  const remMonths = Math.floor((ageDays - years * 365) / 30);
  if (remMonths === 0)
    return `${years} year${years === 1 ? "" : "s"} ago`;
  return `${years} year${years === 1 ? "" : "s"}, ${remMonths} month${remMonths === 1 ? "" : "s"} ago`;
}
