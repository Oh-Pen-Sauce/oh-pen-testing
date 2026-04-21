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
 * prefixes the scanner may walk. An empty list means "the cwd only" —
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
  // URL match — exact origin compare.
  if (/^https?:\/\//i.test(allowed) || /^https?:\/\//i.test(target)) {
    try {
      return new URL(allowed).origin === new URL(target).origin;
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
 * Resolve rate-limit profile for a target. Today only `default` is
 * supported; v1.0 dynamic testing may add per-target overrides.
 */
export function resolveRateLimitProfile(
  config: Config,
  _target: string,
): { requests_per_minute: number; max_concurrent: number } {
  return config.scope.rate_limits.default;
}
