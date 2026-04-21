import fs from "node:fs/promises";
import path from "node:path";
import {
  allocateScanId,
  createNoopLogger,
  type AIProvider,
  type Config,
  type Issue,
  type Logger,
  readIssue,
  writeIssue,
  ScopeViolation,
} from "@oh-pen-testing/shared";
import {
  filterByLanguages,
  loadPlaybooks,
} from "../playbook-runner/loader.js";
import { getBuiltinRules } from "../playbook-runner/builtin-rules/secrets.js";
import { runRegexScan } from "../scanner/regex-scanner.js";
import type { WalkedFile } from "../scanner/file-walker.js";
import { confirmCandidate } from "../scanner/confirm.js";
import { enforceTargetAllowed, enforceTimeWindows } from "../scope/enforce.js";

export interface VerifyOptions {
  cwd: string;
  config: Config;
  issueId: string;
  provider: AIProvider;
  playbookRoots: string[];
  logger?: Logger;
  /**
   * Skip AI confirmation and treat any regex hit as a remaining hit. Used by
   * tests and the "quick verify" mode where we just check regex disappearance.
   */
  skipAiConfirm?: boolean;
}

export interface VerifyResult {
  issue: Issue;
  hitsRemaining: number;
  verified: boolean;
}

/**
 * Re-run the playbook that discovered `issueId` against the file(s) in the
 * issue's location. Writes `verification` metadata back on the issue and
 * transitions status → `verified` when there are zero hits remaining.
 *
 * Honours scope gates the same way runScan does — we won't re-verify during
 * a blocked time window or outside the allowed_targets list.
 */
export async function runVerify(
  options: VerifyOptions,
): Promise<VerifyResult> {
  const { cwd, config, issueId, provider, playbookRoots, skipAiConfirm } =
    options;
  const logger = options.logger ?? createNoopLogger();

  if (!config.scope.authorisation_acknowledged) {
    throw new ScopeViolation(
      "authorisation_not_acknowledged",
      "Verify refused: authorisation has not been acknowledged.",
    );
  }
  enforceTimeWindows(config);
  enforceTargetAllowed(config, cwd, cwd);

  const issue = await readIssue(cwd, issueId);
  const [playbookId] = issue.discovered_by
    .replace(/^playbook:/, "")
    .split("/")
    .reduce<string[]>((acc, part, idx, arr) => {
      // discovered_by format: "playbook:<playbookId>/<ruleId>" — playbookId
      // may itself contain a slash (e.g. secrets/hardcoded-secrets-scanner).
      // Take everything except the last segment.
      if (idx < arr.length - 1) {
        const joined = acc[0] ? `${acc[0]}/${part}` : part;
        return [joined];
      }
      return acc;
    }, []);

  const playbooks = await loadPlaybooks(playbookRoots);
  const playbook = playbooks.find((p) => p.manifest.id === playbookId);
  if (!playbook) {
    throw new Error(
      `Cannot verify ${issueId}: playbook ${playbookId} not found in roots ${playbookRoots.join(", ")}`,
    );
  }

  const rules =
    playbook.manifest.rules.length > 0
      ? playbook.manifest.rules
      : getBuiltinRules(playbook.manifest.id);

  // Re-read the file from disk. It may have been patched by the agent
  // (or the user after merging a PR).
  const abs = path.join(cwd, issue.location.file);
  let content: string;
  try {
    content = await fs.readFile(abs, "utf-8");
  } catch {
    // File deleted or moved as part of the fix — treat as zero hits.
    content = "";
  }
  const walkedFile: WalkedFile = {
    absolutePath: abs,
    relativePath: issue.location.file,
    content,
  };

  const candidates = runRegexScan({
    playbookId: playbook.manifest.id,
    rules,
    files: [walkedFile],
  });

  // Keep only candidates that overlap the original issue's line range.
  const [lineStart, lineEnd] = issue.location.line_range;
  const slack = 5; // allow a small drift for line-number shifts from the fix
  const inRange = candidates.filter((c) => {
    return c.line >= lineStart - slack && c.line <= lineEnd + slack;
  });

  // AI-confirm each remaining candidate (unless test mode). If confirmed
  // hits > 0, the fix didn't land.
  let hitsRemaining = 0;
  if (skipAiConfirm) {
    hitsRemaining = inRange.length;
  } else {
    for (const c of inRange) {
      if (!c.rule.require_ai_confirm) {
        hitsRemaining += 1;
        continue;
      }
      try {
        const verdict = await confirmCandidate({
          provider,
          hit: c,
          scanPrompt: playbook.scanPrompt,
        });
        if (verdict.confirmed) hitsRemaining += 1;
      } catch {
        // On error, be conservative — count as remaining.
        hitsRemaining += 1;
      }
    }
  }

  const scanId = await allocateScanId(cwd);
  const nowIso = new Date().toISOString();
  const verified = hitsRemaining === 0;

  issue.verification = {
    last_run_scan_id: scanId,
    last_run_at: nowIso,
    hits_remaining: hitsRemaining,
    verified_at: verified ? nowIso : null,
  };
  if (verified) issue.status = "verified";

  await writeIssue(cwd, issue);
  logger.info("verify.complete", {
    issue: issue.id,
    hitsRemaining,
    verified,
  });

  return { issue, hitsRemaining, verified };
}
