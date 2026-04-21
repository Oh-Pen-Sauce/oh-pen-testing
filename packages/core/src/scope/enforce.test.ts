import { describe, expect, it } from "vitest";
import {
  buildDefaultConfig,
  type Config,
  ScopeViolation,
} from "@oh-pen-testing/shared";
import {
  enforceTargetAllowed,
  enforceTimeWindows,
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
