import { describe, expect, it } from "vitest";
import { parseGitHubRepo, pingGitHub } from "./index.js";

/**
 * These tests cover the pure, no-network logic in the GitHub pre-flight:
 * the repo-slug validator and the malformed-slug early return in
 * pingGitHub, which shapes a PreflightResult and returns BEFORE any
 * Octokit or git call fires. The live-credential steps (token check,
 * repo access, dry-run push) need a real GitHub token and clone, so they
 * are out of scope for a unit test, see limitations in the task report.
 */
describe("parseGitHubRepo", () => {
  it("splits a well-formed owner/name slug", () => {
    expect(parseGitHubRepo("snrefertech/fourfivesixle")).toEqual({
      owner: "snrefertech",
      repo: "fourfivesixle",
    });
  });

  it("accepts dots, hyphens and underscores in both halves", () => {
    expect(parseGitHubRepo("Oh-Pen-Sauce/oh_pen.testing")).toEqual({
      owner: "Oh-Pen-Sauce",
      repo: "oh_pen.testing",
    });
  });

  it("throws a typed error on a slug with no slash", () => {
    expect(() => parseGitHubRepo("justaname")).toThrow(
      /Invalid GitHub repo: justaname/,
    );
  });

  it("throws on a slug with too many segments", () => {
    expect(() => parseGitHubRepo("owner/name/extra")).toThrow(
      /Expected "owner\/name"/,
    );
  });
});

describe("pingGitHub malformed-slug early return", () => {
  it("returns a failing PreflightResult without touching the network", async () => {
    const result = await pingGitHub({
      token: "ghp_does_not_matter_no_call_is_made",
      repo: "not-a-valid-slug",
      repoPath: "/tmp/nonexistent",
    });

    expect(result.ok).toBe(false);
    expect(result.authenticatedAs).toBeNull();
    expect(result.steps).toHaveLength(1);

    const step = result.steps[0]!;
    expect(step.name).toBe("Repo slug");
    expect(step.status).toBe("fail");
    // The verbatim parser error is surfaced so the user sees exactly why.
    expect(step.detail).toContain("Invalid GitHub repo: not-a-valid-slug");
    expect(step.detail).toContain(
      "Expected owner/name like 'snrefertech/fourfivesixle'",
    );
  });

  it("does not leak the token into the slug-failure detail", async () => {
    const token = "ghp_super_secret_token_value";
    const result = await pingGitHub({
      token,
      repo: "owner/name/extra",
      repoPath: "/tmp/nonexistent",
    });

    expect(result.ok).toBe(false);
    expect(result.steps[0]!.detail).not.toContain(token);
  });
});
