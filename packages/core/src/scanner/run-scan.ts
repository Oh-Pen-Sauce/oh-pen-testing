import {
  allocateIssueId,
  allocateScanId,
  type AIProvider,
  type Config,
  type Issue,
  type Severity,
  type ScanRun,
  writeIssue,
  writeScan,
  createLogger,
  type Logger,
} from "@oh-pen-testing/shared";
import { filterByLanguages, loadPlaybooks, type LoadedPlaybook } from "../playbook-runner/loader.js";
import { getBuiltinRules } from "../playbook-runner/builtin-rules/secrets.js";
import { walkFiles, type WalkedFile } from "./file-walker.js";
import { runRegexScan } from "./regex-scanner.js";
import { confirmCandidate } from "./confirm.js";

export interface RunScanOptions {
  cwd: string;
  config: Config;
  provider: AIProvider;
  playbookRoots: string[];
  logger?: Logger;
  /** Skip AI confirmation — used by unit tests of the regex layer. */
  skipAiConfirm?: boolean;
}

export interface RunScanResult {
  scanId: string;
  issues: Issue[];
  scan: ScanRun;
}

export async function runScan(options: RunScanOptions): Promise<RunScanResult> {
  const { cwd, config, provider, playbookRoots, skipAiConfirm } = options;
  const scanId = await allocateScanId(cwd);
  const logger = options.logger ?? (await createLogger(cwd, scanId));
  const startedAt = new Date().toISOString();

  logger.info("scan.start", { scanId, provider: provider.id });

  const scan: ScanRun = {
    id: scanId,
    started_at: startedAt,
    ended_at: null,
    triggered_by: "cli",
    playbooks_run: 0,
    playbooks_skipped: 0,
    issues_found: 0,
    issues_remediated: 0,
    ai_calls: 0,
    tokens_spent: 0,
    cost_usd: 0,
    provider: provider.id,
    checkpoint: null,
    status: "running",
  };

  try {
    const allPlaybooks = await loadPlaybooks(playbookRoots);
    const relevant = filterByLanguages(allPlaybooks, config.project.primary_languages);
    logger.info("scan.playbooks_loaded", {
      total: allPlaybooks.length,
      relevant: relevant.length,
    });

    const files: WalkedFile[] = [];
    for await (const f of walkFiles(cwd)) files.push(f);
    logger.info("scan.files_walked", { count: files.length });

    const issues: Issue[] = [];

    for (const playbook of relevant) {
      if (playbook.manifest.type !== "regex") {
        scan.playbooks_skipped += 1;
        continue;
      }

      const rules = playbook.manifest.rules.length > 0
        ? playbook.manifest.rules
        : getBuiltinRules(playbook.manifest.id);
      if (rules.length === 0) {
        scan.playbooks_skipped += 1;
        continue;
      }

      const candidates = runRegexScan({
        playbookId: playbook.manifest.id,
        rules,
        files,
      });
      logger.info("playbook.candidates", {
        playbookId: playbook.manifest.id,
        count: candidates.length,
      });

      for (const candidate of candidates) {
        let severity: Severity = playbook.manifest.severity_default;
        let confirmed = true;
        let reasoning = "Rule matched (regex-only).";

        if (!skipAiConfirm && candidate.rule.require_ai_confirm) {
          scan.ai_calls += 1;
          try {
            const verdict = await confirmCandidate({
              provider,
              hit: candidate,
              scanPrompt: playbook.scanPrompt,
            });
            confirmed = verdict.confirmed;
            severity = verdict.severity;
            reasoning = verdict.reasoning;
          } catch (err) {
            logger.warn("playbook.ai_confirm_failed", {
              playbookId: playbook.manifest.id,
              ruleId: candidate.ruleId,
              error: (err as Error).message,
            });
            confirmed = false;
          }
        }

        if (!confirmed) continue;

        const issueId = await allocateIssueId(cwd);
        const issue: Issue = {
          id: issueId,
          title: buildIssueTitle(playbook, candidate.ruleId, candidate.file),
          severity,
          cwe: playbook.manifest.cwe,
          owasp_category: playbook.manifest.owasp_ref,
          status: "backlog",
          assignee: null,
          discovered_at: new Date().toISOString(),
          discovered_by: `playbook:${playbook.manifest.id}/${candidate.ruleId}`,
          scan_id: scanId,
          location: {
            file: candidate.file,
            line_range: candidate.lineRange,
          },
          evidence: {
            code_snippet: candidate.context,
            analysis: reasoning,
          },
          remediation: {
            strategy: playbook.manifest.id,
            auto_fixable: true,
            estimated_diff_size: 4,
            requires_approval: severity === "critical" ? false : false,
          },
          linked_pr: null,
          comments: [],
        };
        await writeIssue(cwd, issue);
        issues.push(issue);
        scan.issues_found += 1;
        logger.info("issue.created", {
          id: issueId,
          severity,
          file: candidate.file,
        });
      }

      scan.playbooks_run += 1;
    }

    scan.ended_at = new Date().toISOString();
    scan.status = "completed";
    await writeScan(cwd, scan);
    logger.info("scan.complete", {
      scanId,
      issues_found: scan.issues_found,
      playbooks_run: scan.playbooks_run,
    });
    return { scanId, issues, scan };
  } catch (err) {
    scan.ended_at = new Date().toISOString();
    scan.status = "failed";
    await writeScan(cwd, scan);
    logger.error("scan.failed", { error: (err as Error).message });
    throw err;
  } finally {
    if (!options.logger) await logger.close();
  }
}

function buildIssueTitle(
  playbook: LoadedPlaybook,
  ruleId: string,
  file: string,
): string {
  const base = playbook.manifest.description || playbook.manifest.id;
  const shortRule = ruleId.replace(/-/g, " ");
  return `${capitalise(shortRule)} in ${file} — ${base}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
