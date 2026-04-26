"use server";

import { revalidatePath } from "next/cache";
import {
  ConfigSchema,
  loadConfig,
  writeConfig,
  STARTER_PLAYBOOK_IDS,
} from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import { resolveProvider, runScan } from "@oh-pen-testing/core";
import { resolveScanTargetPath } from "../../lib/ohpen-cwd";
import { ensureProvidersRegistered } from "../../lib/providers-bootstrap";
import {
  getActiveScan,
  clearActiveScan,
  startStarterScanInBackground,
  startFullScanInBackground,
  type ActiveScanState,
} from "../../lib/active-scan";

/**
 * Run the starter scan — 5 safe regex playbooks, no network, no AI
 * confirm. Result reads back through the existing scans list so the
 * UI refreshes on redirect.
 */
export interface StarterScanSummary {
  ok: true;
  scanId: string;
  issuesFound: number;
  filesScanned: number;
  scannedPath: string;
  playbooksRun: number;
  autonomy: string;
  /** Top files that contributed findings, for the UI summary. */
  topFiles: string[];
  /** True when the user is in a mode where agents auto-open PRs. */
  yoloMode: boolean;
}

export async function runStarterScanAction(): Promise<StarterScanSummary> {
  ensureProvidersRegistered();
  const cwd = await resolveScanTargetPath();
  const config = await loadConfig(cwd);
  const provider = await resolveProvider({ config });

  const result = await runScan({
    cwd,
    config,
    provider,
    playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
    onlyPlaybookIds: [...STARTER_PLAYBOOK_IDS],
    // Starter runs skip AI confirm so there's no per-token cost and
    // the whole thing finishes in seconds. Findings show up flagged
    // as "pattern-matched" rather than "AI-confirmed".
    skipAiConfirm: true,
  });

  // Top 3 files by issue count — the UI shows these so users can
  // see where findings are actually clustered.
  const fileCounts = new Map<string, number>();
  for (const issue of result.issues) {
    const f = issue.location.file;
    fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1);
  }
  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);

  revalidatePath("/scans");
  revalidatePath("/");
  return {
    ok: true,
    scanId: result.scanId,
    issuesFound: result.issues.length,
    filesScanned: result.filesScanned,
    scannedPath: result.scannedPath,
    playbooksRun: result.scan.playbooks_run,
    autonomy: config.agents.autonomy,
    topFiles,
    yoloMode:
      config.agents.autonomy === "yolo" ||
      config.agents.autonomy === "full-yolo",
  };
}

/**
 * Bypass — for experienced users who already know how the tool works
 * and want to skip the starter scan gate. Flips `starter_complete`
 * without actually running a scan.
 */
export async function bypassStarterAction(): Promise<void> {
  const cwd = await resolveScanTargetPath();
  const current = await loadConfig(cwd);
  current.scans.starter_complete = true;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/scans");
  revalidatePath("/");
}

/**
 * Full scan — every bundled + remote playbook relevant to the
 * project's languages, with AI confirmation on. The serious scan.
 *
 * Shares the StarterScanSummary shape so the UI can treat both
 * result types uniformly.
 */
export async function runFullScanAction(): Promise<StarterScanSummary> {
  ensureProvidersRegistered();
  const cwd = await resolveScanTargetPath();
  const config = await loadConfig(cwd);
  const provider = await resolveProvider({ config });

  // No onlyPlaybookIds filter → full catalogue runs. skipAiConfirm
  // defaults to false, so every regex hit gets an AI confirm pass.
  const result = await runScan({
    cwd,
    config,
    provider,
    playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
  });

  const fileCounts = new Map<string, number>();
  for (const issue of result.issues) {
    const f = issue.location.file;
    fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1);
  }
  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);

  revalidatePath("/scans");
  revalidatePath("/board");
  revalidatePath("/");

  return {
    ok: true,
    scanId: result.scanId,
    issuesFound: result.issues.length,
    filesScanned: result.filesScanned,
    scannedPath: result.scannedPath,
    playbooksRun: result.scan.playbooks_run,
    autonomy: config.agents.autonomy,
    topFiles,
    yoloMode:
      config.agents.autonomy === "yolo" ||
      config.agents.autonomy === "full-yolo",
  };
}

/**
 * ────────── Background-scan server actions ──────────
 *
 * These wrap the active-scan singleton in lib/active-scan.ts. The
 * launchers return immediately after kicking the bg promise, so the
 * client is free to navigate away — the scan keeps running in the
 * Node process. The status getter is what the UI polls to show the
 * cooking animation and eventually the result.
 */

export async function startStarterScanInBackgroundAction(): Promise<ActiveScanState> {
  return startStarterScanInBackground();
}

export async function startFullScanInBackgroundAction(): Promise<ActiveScanState> {
  return startFullScanInBackground();
}

export async function getActiveScanAction(): Promise<ActiveScanState | null> {
  const active = getActiveScan();
  // When a bg scan finishes, refresh the scans list / board so polling
  // clients pick up the new data on the same tick they discover the
  // status flip. This is best-effort — revalidatePath outside of an
  // active request does nothing in some Next versions, but won't hurt.
  if (active && active.status !== "running") {
    revalidatePath("/scans");
    revalidatePath("/board");
    revalidatePath("/");
  }
  return active;
}

export async function clearActiveScanAction(): Promise<void> {
  clearActiveScan();
}
