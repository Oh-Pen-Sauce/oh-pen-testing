import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ohpenPaths } from "../paths.js";

export const ScanStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "checkpointed",
]);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

export const ScanRunSchema = z.object({
  id: z.string().regex(/^SCAN-\d{3,}$/),
  started_at: z.string(),
  ended_at: z.string().nullable().default(null),
  triggered_by: z.enum(["cli", "web", "cron", "ci"]).default("cli"),
  /** Playbooks that ran end-to-end (regex/SCA execution finished). */
  playbooks_run: z.number().int().nonnegative().default(0),
  /** Playbooks the runner started but bailed on (no rules, type mismatch, errored). */
  playbooks_skipped: z.number().int().nonnegative().default(0),
  /**
   * Total playbooks in the bundled catalog at scan time, BEFORE any
   * filtering. Helps the scan detail page show "10 of 31 — rest
   * didn't apply" so users don't worry about coverage. Optional
   * because pre-existing scan records on disk don't have it; the
   * UI falls back to playbooks_run + playbooks_skipped when absent.
   */
  playbooks_total: z.number().int().nonnegative().optional(),
  /** Playbooks the language filter excluded (no overlap with project's primary_languages). */
  playbooks_filtered_by_language: z
    .number()
    .int()
    .nonnegative()
    .optional(),
  /** Playbooks the user disabled in Settings → Tests. */
  playbooks_disabled: z.number().int().nonnegative().optional(),
  issues_found: z.number().int().nonnegative().default(0),
  issues_remediated: z.number().int().nonnegative().default(0),
  ai_calls: z.number().int().nonnegative().default(0),
  tokens_spent: z.number().int().nonnegative().default(0),
  cost_usd: z.number().nonnegative().default(0),
  provider: z.string().default(""),
  checkpoint: z.unknown().nullable().default(null),
  status: ScanStatusSchema.default("running"),
});

export type ScanRun = z.infer<typeof ScanRunSchema>;

export async function writeScan(cwd: string, scan: ScanRun): Promise<string> {
  const { scans } = ohpenPaths(cwd);
  await fs.mkdir(scans, { recursive: true });
  const file = path.join(scans, `${scan.id}.json`);
  await fs.writeFile(file, JSON.stringify(scan, null, 2), "utf-8");
  return file;
}

export async function readScan(cwd: string, id: string): Promise<ScanRun> {
  const { scans } = ohpenPaths(cwd);
  const file = path.join(scans, `${id}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return ScanRunSchema.parse(JSON.parse(raw));
}
