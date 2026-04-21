import { createHash, randomBytes } from "node:crypto";
import type { Issue } from "./models/issue.js";
import type { ScanRun } from "./models/scan.js";

/**
 * Telemetry — **strictly opt-in**.
 *
 * By default, Oh Pen Testing never phones home. If a user explicitly
 * enables it in `.ohpentesting/config.yml` (`telemetry.enabled: true`),
 * the tool POSTs an anonymous, scrubbed event to the configured endpoint
 * after each scan. The data feeds a public counter on oh-pen-sauce.com
 * ("100,000 lines analysed, 1,800 issues fixed").
 *
 * Guiding principles:
 * 1. No code content, file paths, issue titles, or repo URLs ever leave
 *    the machine. We only send counts and aggregate severities.
 * 2. Installation identity is a SHA-256 of a locally-generated random
 *    value. Not derivable from hardware, user, or repo.
 * 3. Every payload has an `opt_out_instructions` field pointing at
 *    how to disable — the endpoint server is expected to honour any
 *    "forget me" request based on the anonymous install id.
 */

export const TELEMETRY_DEFAULT_ENDPOINT = "https://oh-pen-sauce.com/api/telemetry/v1/event";

export interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  /** Stored in config.yml so the server can identify duplicate events without
   * knowing anything else about the user. SHA-256'd from a random salt. */
  install_id?: string;
}

export type TelemetryEventType =
  | "scan.completed"
  | "scan.failed"
  | "remediation.pr_opened"
  | "verification.verified"
  | "install.first_run";

export interface TelemetryPayload {
  event: TelemetryEventType;
  install_id: string;
  tool_version: string;
  occurred_at: string;
  opt_out_instructions: string;
  counts: {
    /** Total files walked in the scan. */
    files_scanned?: number;
    /** Approximate total lines (sum of file line counts). Doesn't leak paths. */
    lines_scanned?: number;
    /** Issues by severity. */
    issues_found?: Record<string, number>;
    /** Issues verified in this scan. */
    issues_verified?: number;
    /** PRs opened by agents. */
    prs_opened?: number;
    /** Number of playbooks that ran (excl. skipped). */
    playbooks_run?: number;
  };
  /** Provider id only — "claude-api", "ollama", etc. No keys, no models. */
  provider_class?: string;
}

export function newInstallId(): string {
  const salt = randomBytes(32).toString("hex");
  return createHash("sha256").update(salt).digest("hex").slice(0, 32);
}

export function buildScanCompletedPayload(args: {
  installId: string;
  toolVersion: string;
  scan: ScanRun;
  issues: Issue[];
  filesScanned: number;
  linesScanned: number;
}): TelemetryPayload {
  const issuesBySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  let verified = 0;
  for (const i of args.issues) {
    issuesBySeverity[i.severity] = (issuesBySeverity[i.severity] ?? 0) + 1;
    if (i.status === "verified") verified += 1;
  }
  return {
    event: "scan.completed",
    install_id: args.installId,
    tool_version: args.toolVersion,
    occurred_at: new Date().toISOString(),
    opt_out_instructions:
      "Set telemetry.enabled: false in .ohpentesting/config.yml to stop future events.",
    counts: {
      files_scanned: args.filesScanned,
      lines_scanned: args.linesScanned,
      issues_found: issuesBySeverity,
      issues_verified: verified,
      playbooks_run: args.scan.playbooks_run,
    },
    provider_class: args.scan.provider,
  };
}

/**
 * POST the payload to the endpoint with strict defaults:
 * - 2-second timeout (we never want telemetry to slow a scan)
 * - any error is swallowed (we never want telemetry to break a scan)
 */
export async function sendTelemetry(
  payload: TelemetryPayload,
  endpoint = TELEMETRY_DEFAULT_ENDPOINT,
): Promise<{ sent: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `oh-pen-testing/${payload.tool_version}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { sent: false, error: `HTTP ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}
