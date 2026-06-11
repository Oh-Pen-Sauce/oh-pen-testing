import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildDefaultConfig,
  type Config,
  ScopeViolation,
} from "@oh-pen-testing/shared";
import {
  enforceTargetAllowed,
  enforceTimeWindows,
  resolvePathWithinRepo,
  resolveRateLimitProfile,
} from "./enforce.js";

function cfg(overrides: Partial<Config["scope"]> = {}): Config {
  const base = buildDefaultConfig({
    projectName: "test",
    languages: ["typescript"],
    preferredProvider: "claude-code-cli",
  });
  base.scope = { ...base.scope, ...overrides };
  base.scope.authorisation_acknowledged = true; // pre-condition for these tests
  return base;
}

describe("enforceTimeWindows", () => {
  it("no-op when no windows configured", () => {
    expect(() => enforceTimeWindows(cfg())).not.toThrow();
  });

  it("allows scan inside a same-day window", () => {
    const c = cfg({
      time_windows: [{ start: "09:00", end: "17:00", timezone: "UTC" }],
    });
    // 2026-04-21 12:00 UTC
    const now = new Date("2026-04-21T12:00:00Z");
    expect(() => enforceTimeWindows(c, { now })).not.toThrow();
  });

  it("refuses scan outside a same-day window", () => {
    const c = cfg({
      time_windows: [{ start: "09:00", end: "17:00", timezone: "UTC" }],
    });
    const now = new Date("2026-04-21T20:00:00Z");
    expect(() => enforceTimeWindows(c, { now })).toThrowError(ScopeViolation);
  });

  it("handles windows that cross midnight", () => {
    const c = cfg({
      time_windows: [{ start: "22:00", end: "06:00", timezone: "UTC" }],
    });
    const lateNight = new Date("2026-04-21T23:30:00Z");
    const earlyMorning = new Date("2026-04-21T02:30:00Z");
    const afternoon = new Date("2026-04-21T14:30:00Z");
    expect(() => enforceTimeWindows(c, { now: lateNight })).not.toThrow();
    expect(() => enforceTimeWindows(c, { now: earlyMorning })).not.toThrow();
    expect(() => enforceTimeWindows(c, { now: afternoon })).toThrowError(
      ScopeViolation,
    );
  });
});

describe("enforceTargetAllowed", () => {
  it("allows cwd when allowed_targets is empty", () => {
    const c = cfg({ allowed_targets: [] });
    expect(() => enforceTargetAllowed(c, "/tmp/repo", "/tmp/repo")).not.toThrow();
    expect(() =>
      enforceTargetAllowed(c, "/tmp/repo", "/tmp/repo/src/x.ts"),
    ).not.toThrow();
  });

  it("refuses paths outside cwd when allowed_targets is empty", () => {
    const c = cfg({ allowed_targets: [] });
    expect(() =>
      enforceTargetAllowed(c, "/tmp/repo", "/tmp/other"),
    ).toThrowError(ScopeViolation);
  });

  it("honours explicit path allowlist", () => {
    const c = cfg({ allowed_targets: ["./", "/tmp/sibling"] });
    expect(() =>
      enforceTargetAllowed(c, "/tmp/repo", "/tmp/sibling/deep"),
    ).not.toThrow();
    expect(() =>
      enforceTargetAllowed(c, "/tmp/repo", "/tmp/elsewhere"),
    ).toThrowError(ScopeViolation);
  });

  it("handles URL targets by origin match", () => {
    const c = cfg({ allowed_targets: ["https://staging.myapp.local"] });
    expect(() =>
      enforceTargetAllowed(
        c,
        "/tmp/repo",
        "https://staging.myapp.local/api/users",
      ),
    ).not.toThrow();
    expect(() =>
      enforceTargetAllowed(
        c,
        "/tmp/repo",
        "https://production.myapp.local/api",
      ),
    ).toThrowError(ScopeViolation);
  });
});

describe("resolvePathWithinRepo", () => {
  let repo: string;
  let outside: string;
  beforeEach(async () => {
    repo = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-repo-")));
    outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-out-")));
  });
  afterEach(async () => {
    await fs.rm(repo, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("returns the absolute path for an in-repo file", async () => {
    await fs.writeFile(path.join(repo, "a.ts"), "x", "utf-8");
    const abs = await resolvePathWithinRepo(repo, "a.ts");
    expect(abs).toBe(path.join(repo, "a.ts"));
  });

  it("allows a not-yet-existing in-repo file (new .env.example)", async () => {
    const abs = await resolvePathWithinRepo(repo, ".env.example");
    expect(abs).toBe(path.join(repo, ".env.example"));
  });

  it("refuses a lexical traversal escape", async () => {
    await expect(
      resolvePathWithinRepo(repo, "../../etc/passwd"),
    ).rejects.toThrowError(ScopeViolation);
  });

  it("refuses an absolute path outside the repo", async () => {
    // path.resolve(root, "/etc/passwd") returns "/etc/passwd", which the
    // lexical containment check must reject.
    await expect(
      resolvePathWithinRepo(repo, "/etc/passwd"),
    ).rejects.toThrowError(ScopeViolation);
  });

  it("refuses a symlink that points outside the repo", async () => {
    // Plant a target outside the repo, then a symlink inside the repo
    // that points at it. The lexical path looks in-repo; only realpath
    // catches the escape.
    await fs.writeFile(path.join(outside, "loot.txt"), "secret", "utf-8");
    await fs.symlink(path.join(outside, "loot.txt"), path.join(repo, "link.txt"));
    await expect(
      resolvePathWithinRepo(repo, "link.txt"),
    ).rejects.toThrowError(ScopeViolation);
  });

  it("refuses a file under a symlinked directory pointing outside", async () => {
    await fs.symlink(outside, path.join(repo, "linkdir"), "dir");
    await expect(
      resolvePathWithinRepo(repo, "linkdir/whatever.ts"),
    ).rejects.toThrowError(ScopeViolation);
  });
});

describe("resolveRateLimitProfile", () => {
  it("returns the default profile", () => {
    const c = cfg();
    const profile = resolveRateLimitProfile(c, "/tmp/repo");
    expect(profile.requests_per_minute).toBe(60);
    expect(profile.max_concurrent).toBe(4);
  });

  it("honours overridden defaults", () => {
    const c = cfg({
      rate_limits: {
        default: { requests_per_minute: 10, max_concurrent: 1 },
      },
    });
    const profile = resolveRateLimitProfile(c, "/tmp/repo");
    expect(profile.requests_per_minute).toBe(10);
    expect(profile.max_concurrent).toBe(1);
  });
});
