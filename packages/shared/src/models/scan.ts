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
  playbooks_run: z.number().int().nonnegative().default(0),
  playbooks_skipped: z.number().int().nonnegative().default(0),
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
