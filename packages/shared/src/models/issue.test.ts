import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  allocateIssueId,
  allocateScanId,
  IssueSchema,
  listIssues,
  readIssue,
  writeIssue,
  type Issue,
} from "./issue.js";
import { ohpenPaths } from "../paths.js";

async function makeTempRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ohpen-test-"));
  const p = ohpenPaths(dir);
  await fs.mkdir(p.root, { recursive: true });
  await fs.mkdir(p.issues, { recursive: true });
  return dir;
}

function makeIssue(id: string): Issue {
  return IssueSchema.parse({
    id,
    title: "Test issue",
    severity: "critical",
    cwe: [],
    status: "backlog",
    assignee: null,
    discovered_at: new Date().toISOString(),
    discovered_by: "test",
    scan_id: "SCAN-001",
    location: { file: "x.ts", line_range: [1, 1] },
    evidence: { code_snippet: "x", analysis: "y" },
    linked_pr: null,
    comments: [],
  });
}

describe("issue storage", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await makeTempRepo();
  });
  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("round-trips an issue", async () => {
    const issue = makeIssue("ISSUE-001");
    await writeIssue(cwd, issue);
    const read = await readIssue(cwd, "ISSUE-001");
    expect(read.id).toBe("ISSUE-001");
    expect(read.title).toBe("Test issue");
  });

  it("lists issues", async () => {
    await writeIssue(cwd, makeIssue("ISSUE-001"));
    await writeIssue(cwd, makeIssue("ISSUE-002"));
    const all = await listIssues(cwd);
    expect(all.map((i) => i.id).sort()).toEqual(["ISSUE-001", "ISSUE-002"]);
  });

  it("allocates sequential issue IDs", async () => {
    const id1 = await allocateIssueId(cwd);
    const id2 = await allocateIssueId(cwd);
    const id3 = await allocateIssueId(cwd);
    expect(id1).toBe("ISSUE-001");
    expect(id2).toBe("ISSUE-002");
    expect(id3).toBe("ISSUE-003");
  });

  it("allocates scan IDs independently from issue IDs", async () => {
    const i1 = await allocateIssueId(cwd);
    const s1 = await allocateScanId(cwd);
    const i2 = await allocateIssueId(cwd);
    expect(i1).toBe("ISSUE-001");
    expect(s1).toBe("SCAN-001");
    expect(i2).toBe("ISSUE-002");
  });
});
