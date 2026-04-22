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
import { getOhpenCwd } from "../../lib/ohpen-cwd";
import { ensureProvidersRegistered } from "../../lib/providers-bootstrap";

/**
 * Run the starter scan — 5 safe regex playbooks, no network, no AI
 * confirm. Result reads back through the existing scans list so the
 * UI refreshes on redirect.
 */
export async function runStarterScanAction(): Promise<{
  ok: true;
  scanId: string;
  issuesFound: number;
}> {
  ensureProvidersRegistered();
  const cwd = getOhpenCwd();
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

  revalidatePath("/scans");
  revalidatePath("/");
  return {
    ok: true,
    scanId: result.scanId,
    issuesFound: result.issues.length,
  };
}

/**
 * Bypass — for experienced users who already know how the tool works
 * and want to skip the starter scan gate. Flips `starter_complete`
 * without actually running a scan.
 */
export async function bypassStarterAction(): Promise<void> {
  const cwd = getOhpenCwd();
  const current = await loadConfig(cwd);
  current.scans.starter_complete = true;
  const validated = ConfigSchema.parse(current);
  await writeConfig(cwd, validated);
  revalidatePath("/scans");
  revalidatePath("/");
}
