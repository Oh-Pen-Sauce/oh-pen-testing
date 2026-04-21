import fs from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import { z } from "zod";
import { SeveritySchema } from "../config/schema.js";
import { ohpenPaths } from "../paths.js";

export const IssueStatusSchema = z.enum([
  "backlog",
  "ready",
  "in_progress",
  "in_review",
  "verified",
  "done",
  "wont_fix",
]);
export type IssueStatus = z.infer<typeof IssueStatusSchema>;

export const VerificationSchema = z.object({
  last_run_scan_id: z.string().nullable().default(null),
  last_run_at: z.string().nullable().default(null),
  hits_remaining: z.number().int().nullable().default(null),
  verified_at: z.string().nullable().default(null),
});
export type Verification = z.infer<typeof VerificationSchema>;

export const IssueSchema = z.object({
  id: z.string().regex(/^ISSUE-\d{3,}$/),
  title: z.string().min(1),
  severity: SeveritySchema,
  cvss_score: z.number().min(0).max(10).optional(),
  cwe: z.array(z.string()).default([]),
  owasp_category: z.string().optional(),
  status: IssueStatusSchema.default("backlog"),
  assignee: z.string().nullable().default(null),
  discovered_at: z.string(),
  discovered_by: z.string(),
  scan_id: z.string(),
  location: z.object({
    file: z.string(),
    line_range: z.tuple([z.number(), z.number()]),
  }),
  evidence: z.object({
    // Raw, machine-verifiable data. What the scanner literally produced.
    rule_id: z.string().optional(),
    code_snippet: z.string(),
    match_position: z
      .object({
        line: z.number().int().positive(),
        column: z.number().int().nonnegative(),
        length: z.number().int().nonnegative(),
      })
      .optional(),
    // AI-advisory interpretation. The LLM's read of the raw finding.
    analysis: z.string(),
    ai_reasoning: z.string().optional(),
    ai_model: z.string().optional(),
    ai_confidence: z.enum(["low", "medium", "high"]).optional(),
  }),
  remediation: z
    .object({
      strategy: z.string(),
      auto_fixable: z.boolean().default(true),
      estimated_diff_size: z.number().int().nonnegative().default(0),
      requires_approval: z.boolean().default(false),
    })
    .optional(),
  linked_pr: z.string().url().nullable().default(null),
  verification: VerificationSchema.default({
    last_run_scan_id: null,
    last_run_at: null,
    hits_remaining: null,
    verified_at: null,
  }),
  comments: z
    .array(
      z.object({
        author: z.string(),
        text: z.string(),
        at: z.string(),
      }),
    )
    .default([]),
});

export type Issue = z.infer<typeof IssueSchema>;

interface CounterFile {
  nextIssueId: number;
  nextScanId: number;
  lastUpdated: string;
}

const DEFAULT_COUNTER: CounterFile = {
  nextIssueId: 1,
  nextScanId: 1,
  lastUpdated: new Date(0).toISOString(),
};

async function readCounter(cwd: string): Promise<CounterFile> {
  const { counter } = ohpenPaths(cwd);
  try {
    const raw = await fs.readFile(counter, "utf-8");
    return { ...DEFAULT_COUNTER, ...JSON.parse(raw) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_COUNTER };
    }
    throw err;
  }
}

async function writeCounter(cwd: string, data: CounterFile): Promise<void> {
  const { counter } = ohpenPaths(cwd);
  await fs.writeFile(counter, JSON.stringify(data, null, 2), "utf-8");
}

export async function allocateIssueId(cwd: string): Promise<string> {
  const { counter } = ohpenPaths(cwd);
  // Ensure the file exists so lockfile can lock it
  try {
    await fs.access(counter);
  } catch {
    await writeCounter(cwd, DEFAULT_COUNTER);
  }
  const release = await lockfile.lock(counter, {
    retries: { retries: 10, minTimeout: 30, maxTimeout: 200 },
  });
  try {
    const c = await readCounter(cwd);
    const id = `ISSUE-${String(c.nextIssueId).padStart(3, "0")}`;
    c.nextIssueId += 1;
    c.lastUpdated = new Date().toISOString();
    await writeCounter(cwd, c);
    return id;
  } finally {
    await release();
  }
}

export async function allocateScanId(cwd: string): Promise<string> {
  const { counter } = ohpenPaths(cwd);
  try {
    await fs.access(counter);
  } catch {
    await writeCounter(cwd, DEFAULT_COUNTER);
  }
  const release = await lockfile.lock(counter, {
    retries: { retries: 10, minTimeout: 30, maxTimeout: 200 },
  });
  try {
    const c = await readCounter(cwd);
    const id = `SCAN-${String(c.nextScanId).padStart(3, "0")}`;
    c.nextScanId += 1;
    c.lastUpdated = new Date().toISOString();
    await writeCounter(cwd, c);
    return id;
  } finally {
    await release();
  }
}

export async function writeIssue(cwd: string, issue: Issue): Promise<string> {
  const { issues } = ohpenPaths(cwd);
  await fs.mkdir(issues, { recursive: true });
  const file = path.join(issues, `${issue.id}.json`);
  await fs.writeFile(file, JSON.stringify(issue, null, 2), "utf-8");
  return file;
}

export async function readIssue(cwd: string, id: string): Promise<Issue> {
  const { issues } = ohpenPaths(cwd);
  const file = path.join(issues, `${id}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return IssueSchema.parse(JSON.parse(raw));
}

export async function listIssues(cwd: string): Promise<Issue[]> {
  const { issues } = ohpenPaths(cwd);
  try {
    const files = await fs.readdir(issues);
    const out: Issue[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(issues, f), "utf-8");
        out.push(IssueSchema.parse(JSON.parse(raw)));
      } catch {
        // skip malformed
      }
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}
