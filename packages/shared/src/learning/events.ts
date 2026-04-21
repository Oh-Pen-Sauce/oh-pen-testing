import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * Learning-mode event log.
 *
 * When enabled, every issue lifecycle transition (regex hit, AI confirm,
 * accept, reject, verify) writes one NDJSON line to
 * `.ohpentesting/learning/<date>.ndjson`. The records are:
 *
 *   - strictly local (never shipped unless the user also has telemetry
 *     opted in, and even then only the aggregate counts leave the box —
 *     see packages/shared/src/telemetry.ts)
 *   - free of file contents, file paths, and URLs — only ids, categories,
 *     severities, and booleans
 *
 * This is the scaffold for future playbook tuning: the team can review
 * the local log to see which rules fire noisily, which get rejected by
 * AI confirm, and which AI confirms the humans override.
 */

export const LearningEventSchema = z.object({
  ts: z.string(),
  kind: z.enum([
    "regex_hit",
    "ai_confirm_true",
    "ai_confirm_false",
    "issue_created",
    "fix_proposed",
    "fix_accepted",
    "fix_rejected",
    "fix_verified",
    "human_override",
  ]),
  playbook_id: z.string(),
  rule_id: z.string().optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  /** True if there was a human-in-the-loop decision. */
  human_touched: z.boolean().default(false),
  /** Free-form anonymised tag for aggregate analysis. No file paths. */
  tag: z.string().optional(),
});
export type LearningEvent = z.infer<typeof LearningEventSchema>;

function learningDir(repoRoot: string): string {
  return path.join(repoRoot, ".ohpentesting", "learning");
}

function fileFor(date: Date): string {
  const iso = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${iso}.ndjson`;
}

/**
 * Append one learning event. Strict no-throw: if we can't write the
 * event (disk full, permissions) we swallow the error — learning mode
 * is best-effort and must never break a scan.
 */
export async function recordLearningEvent(
  repoRoot: string,
  event: Omit<LearningEvent, "ts">,
): Promise<void> {
  try {
    const withTs: LearningEvent = { ts: new Date().toISOString(), ...event };
    LearningEventSchema.parse(withTs);
    const dir = learningDir(repoRoot);
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, fileFor(new Date()));
    await fs.appendFile(outPath, JSON.stringify(withTs) + "\n", "utf-8");
  } catch {
    /* strict no-throw */
  }
}

/**
 * Read every learning event in the repo (newest day first). Used by
 * `opt telemetry learning-summary` and the web /learning page.
 */
export async function readLearningEvents(
  repoRoot: string,
): Promise<LearningEvent[]> {
  const dir = learningDir(repoRoot);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  files.sort().reverse(); // newest day first
  const events: LearningEvent[] = [];
  for (const file of files) {
    if (!file.endsWith(".ndjson")) continue;
    let raw: string;
    try {
      raw = await fs.readFile(path.join(dir, file), "utf-8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const parsed = LearningEventSchema.safeParse(obj);
        if (parsed.success) events.push(parsed.data);
      } catch {
        /* skip malformed */
      }
    }
  }
  return events;
}

/** Aggregate a list of events into a per-playbook signal map. */
export function summariseLearning(
  events: LearningEvent[],
): Array<{
  playbook_id: string;
  regex_hits: number;
  ai_confirmed: number;
  ai_rejected: number;
  fixes_accepted: number;
  fixes_rejected: number;
  human_overrides: number;
}> {
  const byId = new Map<string, ReturnType<typeof summariseLearning>[number]>();
  for (const e of events) {
    let entry = byId.get(e.playbook_id);
    if (!entry) {
      entry = {
        playbook_id: e.playbook_id,
        regex_hits: 0,
        ai_confirmed: 0,
        ai_rejected: 0,
        fixes_accepted: 0,
        fixes_rejected: 0,
        human_overrides: 0,
      };
      byId.set(e.playbook_id, entry);
    }
    switch (e.kind) {
      case "regex_hit":
        entry.regex_hits += 1;
        break;
      case "ai_confirm_true":
        entry.ai_confirmed += 1;
        break;
      case "ai_confirm_false":
        entry.ai_rejected += 1;
        break;
      case "fix_accepted":
        entry.fixes_accepted += 1;
        break;
      case "fix_rejected":
        entry.fixes_rejected += 1;
        break;
      case "human_override":
        entry.human_overrides += 1;
        break;
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.regex_hits - a.regex_hits);
}
