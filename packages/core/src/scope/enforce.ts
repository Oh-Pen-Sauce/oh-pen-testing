import fs from "node:fs/promises";
import path from "node:path";
import {
  type Config,
  type TimeWindow,
  ScopeViolation,
} from "@oh-pen-testing/shared";

export interface ScopeCheckContext {
  now?: Date;
}

/**
 * Enforce time-window policy. No-op when `scope.time_windows` is empty.
 * Throws ScopeViolation if current wall-clock is outside every window.
 */
export function enforceTimeWindows(
  config: Config,
  ctx: ScopeCheckContext = {},
): void {
  const windows = config.scope.time_windows;
  if (windows.length === 0) return;
  const now = ctx.now ?? new Date();
  for (const w of windows) {
    if (isWithinWindow(now, w)) return;
  }
  throw new ScopeViolation(
    "outside_time_window",
    `Scan refused: current time is outside all configured scope.time_windows (${windows
      .map((w) => `${w.start}-${w.end} ${w.timezone}`)
      .join(", ")}).`,
    { windows, nowUtc: now.toISOString() },
  );
}

/**
 * Enforce allowed_targets policy.
 *
 * For static scanning (v0.5) we interpret `scope.allowed_targets` as path
 * prefixes the scanner may walk. An empty list means "the cwd only":
 * the default, safe behaviour for the single-repo use case.
 *
 * A target is allowed if:
 *  - the list is empty AND the path is inside the cwd; OR
 *  - the path is inside (or equals) one of the allowed-target paths.
 *
 * URL targets (v1.0 dynamic testing) are accepted literally and matched
 * by exact origin.
 */
export function enforceTargetAllowed(
  config: Config,
  cwd: string,
  target: string,
): void {
  const allowed = config.scope.allowed_targets;
  if (allowed.length === 0) {
    // Default: cwd only. Target must resolve under cwd.
    const absTarget = path.resolve(cwd, target);
    const absCwd = path.resolve(cwd);
    if (absTarget === absCwd || absTarget.startsWith(absCwd + path.sep)) return;
    throw new ScopeViolation(
      "target_not_allowed",
      `Target ${target} is outside the current repo (${absCwd}). Add it to scope.allowed_targets if you have authorisation.`,
      { target, cwd: absCwd },
    );
  }
  // Explicit allowlist.
  for (const a of allowed) {
    if (matchesAllowedTarget(cwd, a, target)) return;
  }
  throw new ScopeViolation(
    "target_not_allowed",
    `Target ${target} is not in scope.allowed_targets (${allowed.join(", ")}).`,
    { target, allowed },
  );
}

function matchesAllowedTarget(
  cwd: string,
  allowed: string,
  target: string,
): boolean {
  // URL match: exact origin compare, http/https only. The protocol
  // guard is defence-in-depth: the regex above already gates entry to
  // this branch, but re-checking the parsed protocol means a crafted
  // target can never match through some other scheme.
  if (/^https?:\/\//i.test(allowed) || /^https?:\/\//i.test(target)) {
    try {
      const a = new URL(allowed);
      const t = new URL(target);
      if (!/^https?:$/.test(a.protocol) || !/^https?:$/.test(t.protocol)) {
        return false;
      }
      return a.origin === t.origin;
    } catch {
      return false;
    }
  }
  // Path prefix match.
  const absAllowed = path.resolve(cwd, allowed);
  const absTarget = path.resolve(cwd, target);
  return (
    absTarget === absAllowed || absTarget.startsWith(absAllowed + path.sep)
  );
}

function isWithinWindow(now: Date, window: TimeWindow): boolean {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: window.timezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const nowMinutes = Number(hh) * 60 + Number(mm);
  const startMinutes = parseHHMM(window.start);
  const endMinutes = parseHHMM(window.end);
  if (startMinutes <= endMinutes) {
    // Same-day window, e.g. 09:00-17:00.
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Crosses midnight, e.g. 22:00-06:00.
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map((x) => Number(x));
  return h! * 60 + m!;
}

/**
 * Resolve `relFile` against `repoRoot` and assert it stays inside the
 * repo, defending against both lexical traversal (../) and symlink
 * escape. Returns the absolute path to use for a read or write.
 *
 * Why this exists: a remediation agent writes the file named in an
 * issue record. Issue records are JSON on disk that survive across
 * runs, so a tampered or poisoned `location.file` (a `../../etc/...`
 * relative, or a path sitting under a symlink that points outside the
 * repo) must never let the agent read or write outside the project it
 * was pointed at. Both layers below are required: the lexical check
 * catches `..` relatives; the realpath check catches symlinks.
 */
export async function resolvePathWithinRepo(
  repoRoot: string,
  relFile: string,
): Promise<string> {
  const realRoot = await fs.realpath(repoRoot);
  const within = (p: string): boolean =>
    p === realRoot || p.startsWith(realRoot + path.sep);

  // Lexical layer: resolve and prefix-check.
  const abs = path.resolve(realRoot, relFile);
  if (!within(abs)) {
    throw new ScopeViolation(
      "path_escape",
      `Refusing to access ${relFile}: it resolves outside the repo (${realRoot}).`,
      { relFile, resolved: abs, repoRoot: realRoot },
    );
  }

  // Symlink layer: realpath the deepest ancestor that actually exists
  // (the target file may be brand-new, e.g. a fresh .env.example), then
  // re-check containment with the not-yet-created tail appended.
  let ancestor = abs;
  for (;;) {
    try {
      await fs.access(ancestor);
      break;
    } catch {
      const parent = path.dirname(ancestor);
      if (parent === ancestor) break; // reached the filesystem root
      ancestor = parent;
    }
  }
  const realAncestor = await fs.realpath(ancestor);
  const tail = path.relative(ancestor, abs);
  const effective = tail ? path.join(realAncestor, tail) : realAncestor;
  if (!within(effective)) {
    throw new ScopeViolation(
      "path_escape",
      `Refusing to access ${relFile}: it resolves through a symlink to outside the repo (${realRoot}).`,
      { relFile, resolved: effective, repoRoot: realRoot },
    );
  }
  return abs;
}

/**
 * Resolve rate-limit profile for a target. Today only `default` is
 * supported; v1.0 dynamic testing may add per-target overrides.
 */
export function resolveRateLimitProfile(
  config: Config,
  _target: string,
): { requests_per_minute: number; max_concurrent: number } {
  return config.scope.rate_limits.default;
}
