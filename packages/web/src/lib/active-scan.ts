/**
 * Process-level active-scan registry.
 *
 * Scans are kicked off as fire-and-forget background promises that
 * outlive the request that started them. Without this, a user who
 * starts a scan and then navigates away loses all progress — the
 * server-action promise resolves to nothing because the client moved
 * on.
 *
 * The state lives in module scope so it survives across requests
 * within the same Node process. In dev (Next's hot reload) it CAN
 * get reset on file change; that's fine — the user reloads anyway.
 * In prod it persists for the lifetime of the server.
 *
 * We track only ONE active scan at a time. If the user kicks off a
 * full scan while a starter is still running, we just refuse and
 * return the existing one. Two parallel scans would chew on the same
 * filesystem and fight over the issues directory — not a useful
 * thing to support.
 */
import {
  loadConfig,
  STARTER_PLAYBOOK_IDS,
} from "@oh-pen-testing/shared";
import { BUNDLED_PLAYBOOKS_DIR } from "@oh-pen-testing/playbooks-core";
import { resolveProvider, runScan } from "@oh-pen-testing/core";
import { resolveScanTargetPath } from "./ohpen-cwd";
import { ensureProvidersRegistered } from "./providers-bootstrap";

export type ActiveScanKind = "starter" | "full";

/**
 * Mirror of StarterScanSummary defined in ../app/scans/actions.ts —
 * duplicated here to keep this lib free of UI-package imports. The
 * shape stays identical so the wire format is uniform.
 */
export interface ActiveScanSummary {
  ok: true;
  scanId: string;
  issuesFound: number;
  filesScanned: number;
  scannedPath: string;
  playbooksRun: number;
  autonomy: string;
  topFiles: string[];
  yoloMode: boolean;
}

export interface ActiveScanState {
  /** Stable id for this run — useful for the UI to detect "new run". */
  id: string;
  kind: ActiveScanKind;
  /** epoch ms when the scan was kicked off. */
  startedAt: number;
  status: "running" | "completed" | "failed";
  /** Populated once status === "completed". */
  summary?: ActiveScanSummary;
  /** Populated once status === "failed". */
  error?: string;
}

// Module singleton. Intentionally a wrapper object so we can mutate
// in place (the state object reference stays stable across reads).
const state: { current: ActiveScanState | null } = { current: null };

export function getActiveScan(): ActiveScanState | null {
  return state.current;
}

export function clearActiveScan(): void {
  // Don't clear if a scan is mid-flight — that would leave the bg
  // promise updating a detached object, and the UI would think
  // there's no scan when there really is.
  if (state.current?.status !== "running") {
    state.current = null;
  }
}

/**
 * Start a starter scan in the background. If one is already running
 * (any kind), returns the existing entry instead of starting a new
 * one — the UI should poll its status.
 */
export function startStarterScanInBackground(): ActiveScanState {
  if (state.current?.status === "running") return state.current;
  const entry: ActiveScanState = {
    id: `bg-${Date.now().toString(36)}`,
    kind: "starter",
    startedAt: Date.now(),
    status: "running",
  };
  state.current = entry;
  // Fire-and-forget — Node keeps this promise alive in module scope.
  void runStarterAndCapture(entry);
  return entry;
}

/**
 * Start a full-catalog scan in the background. Same one-at-a-time
 * semantics as starter.
 */
export function startFullScanInBackground(): ActiveScanState {
  if (state.current?.status === "running") return state.current;
  const entry: ActiveScanState = {
    id: `bg-${Date.now().toString(36)}`,
    kind: "full",
    startedAt: Date.now(),
    status: "running",
  };
  state.current = entry;
  void runFullAndCapture(entry);
  return entry;
}

// ───────── internal runners ─────────

async function runStarterAndCapture(entry: ActiveScanState): Promise<void> {
  try {
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
      skipAiConfirm: true,
    });
    entry.summary = summariseScan(result, config.agents.autonomy);
    entry.status = "completed";
  } catch (err) {
    entry.error = (err as Error).message ?? "Unknown scan error";
    entry.status = "failed";
  }
}

async function runFullAndCapture(entry: ActiveScanState): Promise<void> {
  try {
    ensureProvidersRegistered();
    const cwd = await resolveScanTargetPath();
    const config = await loadConfig(cwd);
    const provider = await resolveProvider({ config });
    const result = await runScan({
      cwd,
      config,
      provider,
      playbookRoots: [BUNDLED_PLAYBOOKS_DIR],
    });
    entry.summary = summariseScan(result, config.agents.autonomy);
    entry.status = "completed";
  } catch (err) {
    entry.error = (err as Error).message ?? "Unknown scan error";
    entry.status = "failed";
  }
}

// Shape mirror — keeps UI/wire format identical to runStarterScanAction.
function summariseScan(
  result: Awaited<ReturnType<typeof runScan>>,
  autonomy: string,
): ActiveScanSummary {
  const fileCounts = new Map<string, number>();
  for (const issue of result.issues) {
    const f = issue.location.file;
    fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1);
  }
  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);
  return {
    ok: true,
    scanId: result.scanId,
    issuesFound: result.issues.length,
    filesScanned: result.filesScanned,
    scannedPath: result.scannedPath,
    playbooksRun: result.scan.playbooks_run,
    autonomy,
    topFiles,
    yoloMode: autonomy === "yolo" || autonomy === "full-yolo",
  };
}
