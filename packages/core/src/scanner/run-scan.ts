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
  writeConfig,
  ConfigSchema,
  createLogger,
  type Logger,
  RateLimitError,
  ScopeViolation,
  recordLearningEvent,
} from "@oh-pen-testing/shared";
import {
  createRateLimitManager,
  type RateLimitManager,
} from "@oh-pen-testing/rate-limit";
import { filterByLanguages, loadPlaybooks, type LoadedPlaybook } from "../playbook-runner/loader.js";
import { getBuiltinRules } from "../playbook-runner/builtin-rules/secrets.js";
import { walkFiles, type WalkedFile } from "./file-walker.js";
import { runRegexScan } from "./regex-scanner.js";
import { runScaScan } from "./sca-scanner.js";
import { confirmCandidate } from "./confirm.js";
import {
  enforceTargetAllowed,
  enforceTimeWindows,
} from "../scope/enforce.js";
import { runGitBlame } from "../blame/git-blame.js";

export class RateLimitHalt extends Error {
  constructor(
    message: string,
    public readonly reason: "soft_cap" | "hard_cap" | "window_exhausted" | "provider",
    public readonly scanId: string,
  ) {
    super(message);
    this.name = "RateLimitHalt";
  }
}

export interface RunScanOptions {
  cwd: string;
  config: Config;
  provider: AIProvider;
  playbookRoots: string[];
  logger?: Logger;
  /** Skip AI confirmation — used by unit tests of the regex layer. */
  skipAiConfirm?: boolean;
  /** Optional rate-limit manager; if omitted, one is built from provider.rateLimitStrategy(). */
  rateLimitManager?: RateLimitManager;
  /**
   * If provided, only playbooks whose id is in this list will run.
   * Used by the "starter scan" flow (5 safe regex playbooks) and by
   * the forthcoming `--only <id>` CLI flag.
   */
  onlyPlaybookIds?: readonly string[];
}

export interface RunScanResult {
  scanId: string;
  issues: Issue[];
  scan: ScanRun;
  /**
   * How many files the walker actually inspected after .gitignore +
   * default-ignore pruning. Surfaced in the UI so users can see
   * exactly what got scanned ("Scanned 247 files against 5 playbooks").
   */
  filesScanned: number;
  /** Absolute path of the directory that was scanned. */
  scannedPath: string;
}

export async function runScan(options: RunScanOptions): Promise<RunScanResult> {
  const { cwd, config, provider, playbookRoots, skipAiConfirm, onlyPlaybookIds } = options;

  // Hard gate: refuse to start any scan without explicit authorisation ack.
  // This is Principle 1 of the PRD — "authorised testing only, you own the
  // authorisation". Wizard/CLI must have set this true before we touch a file.
  if (!config.scope.authorisation_acknowledged) {
    throw new ScopeViolation(
      "authorisation_not_acknowledged",
      "Scan refused: authorisation has not been acknowledged. Run `opt scan` interactively (you'll be prompted), or complete the web setup wizard, or set `scope.authorisation_acknowledged: true` in .ohpentesting/config.yml after confirming you are authorised to test this codebase.",
    );
  }

  // Hard gate: time-window check. If the user configured scope.time_windows,
  // halt any scan started outside all of them. No-op when windows are empty
  // (the indie-dev default).
  enforceTimeWindows(config);

  // Hard gate: target allowlist. v0.5 is static-only, so the "target" is the
  // cwd — must be in allowed_targets (if set) or match the default (== cwd).
  enforceTargetAllowed(config, cwd, cwd);

  const scanId = await allocateScanId(cwd);
  const logger = options.logger ?? (await createLogger(cwd, scanId));
  const startedAt = new Date().toISOString();

  const rateLimitManager =
    options.rateLimitManager ??
    createRateLimitManager({
      strategy: provider.rateLimitStrategy(),
      budgetUsd: config.ai.rate_limit.budget_usd,
    });

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
    // Filter stack — each step narrows the set.
    const byLanguage = filterByLanguages(
      allPlaybooks,
      config.project.primary_languages,
    );
    // onlyPlaybookIds wins over everything else — used by starter scan
    // and by `--only` to restrict a run to a specific subset.
    const byOnly = onlyPlaybookIds
      ? byLanguage.filter((p) => onlyPlaybookIds.includes(p.manifest.id))
      : byLanguage;
    // disabled_playbooks is the user's opt-out list from Settings → Tests.
    const disabled = new Set(config.scans.disabled_playbooks ?? []);
    const relevant = byOnly.filter((p) => !disabled.has(p.manifest.id));
    logger.info("scan.playbooks_loaded", {
      total: allPlaybooks.length,
      byLanguage: byLanguage.length,
      afterOnly: byOnly.length,
      disabled: byOnly.length - relevant.length,
      relevant: relevant.length,
    });

    const files: WalkedFile[] = [];
    for await (const f of walkFiles(cwd)) files.push(f);
    logger.info("scan.files_walked", { count: files.length });

    const issues: Issue[] = [];

    /*
     * Dedup set for the scan. Keyed on
     *   <playbookId>::<ruleId>::<file>::<startLine>-<endLine>
     * so the same rule matching the same line twice (common when a
     * multi-pattern rule hits overlapping substrings, or a file is
     * walked via two symlinks) only produces one issue. Different
     * playbooks / rules on the same line stay separate — those are
     * legitimately distinct findings.
     */
    const dedupKeys = new Set<string>();

    for (const playbook of relevant) {
      // SCA playbooks shell out to external auditors (npm audit / pip-audit
      // / bundler-audit). Different runtime path from regex playbooks.
      if (playbook.manifest.type === "sca") {
        try {
          const scaResult = await runScaScan(
            cwd,
            playbook.manifest.sca_sources,
          );
          logger.info("playbook.sca", {
            playbookId: playbook.manifest.id,
            findings: scaResult.findings.length,
            skipped: scaResult.skippedSources,
          });
          for (const f of scaResult.findings) {
            const issueId = await allocateIssueId(cwd);
            const issue: Issue = {
              id: issueId,
              title: `${f.packageName}${f.installedVersion ? `@${f.installedVersion}` : ""} — ${f.summary}`,
              severity: f.severity,
              cwe: playbook.manifest.cwe,
              owasp_category: playbook.manifest.owasp_ref,
              status: "backlog",
              assignee: null,
              discovered_at: new Date().toISOString(),
              discovered_by: `playbook:${playbook.manifest.id}/${f.source}`,
              scan_id: scanId,
              location: { file: f.file, line_range: [1, 1] },
              evidence: {
                rule_id: f.source,
                code_snippet: `${f.packageName}${f.installedVersion ? `@${f.installedVersion}` : ""}`,
                analysis: f.summary,
                ai_reasoning: f.recommendation ?? f.summary,
                ai_model: f.source,
                ai_confidence: "high",
              },
              remediation: {
                strategy: playbook.manifest.id,
                auto_fixable: f.fixAvailable,
                estimated_diff_size: 1,
                requires_approval: false,
              },
              linked_pr: null,
              verification: {
                last_run_scan_id: null,
                last_run_at: null,
                hits_remaining: null,
                verified_at: null,
              },
              blame: {
                oldest_commit_sha: null,
                oldest_commit_iso: null,
                oldest_commit_author: null,
                oldest_commit_summary: null,
                age_days: null,
                contributors: [],
              },
              comments: [],
            };
            await writeIssue(cwd, issue);
            issues.push(issue);
            scan.issues_found += 1;
          }
          scan.playbooks_run += 1;
        } catch (err) {
          logger.error("playbook.sca_failed", {
            playbookId: playbook.manifest.id,
            error: (err as Error).message,
          });
          scan.playbooks_skipped += 1;
        }
        continue;
      }

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

        if (config.learning.enabled) {
          await recordLearningEvent(cwd, {
            kind: "regex_hit",
            playbook_id: playbook.manifest.id,
            rule_id: candidate.ruleId,
            severity: playbook.manifest.severity_default,
            human_touched: false,
          });
        }

        if (!skipAiConfirm && candidate.rule.require_ai_confirm) {
          const gate = rateLimitManager.beforeCall();
          if (gate === "hard_cap" || gate === "window_exhausted") {
            scan.ended_at = new Date().toISOString();
            scan.status = "failed";
            scan.tokens_spent = rateLimitManager.snapshot().tokensIn + rateLimitManager.snapshot().tokensOut;
            scan.cost_usd = rateLimitManager.snapshot().estimatedCostUsd;
            await writeScan(cwd, scan);
            logger.error("scan.halted", { reason: gate, scanId });
            throw new RateLimitHalt(
              `Scan halted: ${gate}. Utilisation ${rateLimitManager.utilisationPct().toFixed(0)}%.`,
              gate,
              scanId,
            );
          }
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
            // We don't see usage from confirm directly — approximate via provider call chain.
            // confirmCandidate will be extended to return usage in M2.
          } catch (err) {
            if (err instanceof RateLimitError) {
              scan.ended_at = new Date().toISOString();
              scan.status = "failed";
              await writeScan(cwd, scan);
              throw new RateLimitHalt(err.message, "provider", scanId);
            }
            logger.warn("playbook.ai_confirm_failed", {
              playbookId: playbook.manifest.id,
              ruleId: candidate.ruleId,
              error: (err as Error).message,
            });
            confirmed = false;
          }
        }

        if (config.learning.enabled && candidate.rule.require_ai_confirm) {
          await recordLearningEvent(cwd, {
            kind: confirmed ? "ai_confirm_true" : "ai_confirm_false",
            playbook_id: playbook.manifest.id,
            rule_id: candidate.ruleId,
            severity,
            human_touched: false,
          });
        }

        if (!confirmed) continue;

        // Dedup: skip if we've already emitted an issue for exactly
        // this (playbook, rule, file, line-range). Keeps the board
        // from being spammed when the same rule matches overlapping
        // substrings on a single line, or when a file appears twice
        // via symlinks.
        const dedupKey = `${playbook.manifest.id}::${candidate.ruleId}::${candidate.file}::${candidate.lineRange[0]}-${candidate.lineRange[1]}`;
        if (dedupKeys.has(dedupKey)) {
          logger.info("issue.deduped", {
            playbookId: playbook.manifest.id,
            ruleId: candidate.ruleId,
            file: candidate.file,
            line: candidate.lineRange[0],
          });
          continue;
        }
        dedupKeys.add(dedupKey);

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
            rule_id: candidate.ruleId,
            code_snippet: candidate.context,
            match_position: {
              line: candidate.line,
              column: 0,
              length: candidate.match.length,
            },
            analysis: reasoning,
            ai_reasoning: reasoning,
            ai_model: provider.id,
            ai_confidence:
              severity === "critical" || severity === "high"
                ? "high"
                : severity === "medium"
                  ? "medium"
                  : "low",
          },
          remediation: {
            strategy: playbook.manifest.id,
            auto_fixable: true,
            estimated_diff_size: 4,
            requires_approval: severity === "critical" ? false : false,
          },
          linked_pr: null,
          verification: {
            last_run_scan_id: null,
            last_run_at: null,
            hits_remaining: null,
            verified_at: null,
          },
          blame: {
            oldest_commit_sha: null,
            oldest_commit_iso: null,
            oldest_commit_author: null,
            oldest_commit_summary: null,
            age_days: null,
            contributors: [],
          },
          comments: [],
        };
        // Enrich with git blame if this is a git repo. Failures are silent
        // so non-git scans (e.g. a tarball) still produce issues.
        try {
          const blame = await runGitBlame(
            cwd,
            candidate.file,
            candidate.lineRange[0],
            candidate.lineRange[1],
          );
          if (blame.oldestCommit) {
            issue.blame = {
              oldest_commit_sha: blame.oldestCommit.commitSha,
              oldest_commit_iso: blame.oldestCommit.authorTimeIso,
              oldest_commit_author: blame.oldestCommit.author,
              oldest_commit_summary: blame.oldestCommit.summary,
              age_days: blame.ageDays,
              contributors: blame.uniqueAuthors,
            };
          }
        } catch {
          // non-git / file not tracked → leave blame block null
        }
        await writeIssue(cwd, issue);
        issues.push(issue);
        scan.issues_found += 1;
        logger.info("issue.created", {
          id: issueId,
          severity,
          file: candidate.file,
        });
        if (config.learning.enabled) {
          await recordLearningEvent(cwd, {
            kind: "issue_created",
            playbook_id: playbook.manifest.id,
            rule_id: candidate.ruleId,
            severity,
            human_touched: false,
          });
        }
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

    // First successful scan of any kind unlocks the full-scan path in
    // the web UI. `opt scan --starter` and a full `opt scan` both flip
    // it; the `--bypass` flag in the web Scans page also flips it
    // via its own server action without actually running a scan.
    if (!config.scans.starter_complete) {
      try {
        const updated = { ...config };
        updated.scans = {
          ...config.scans,
          starter_complete: true,
        };
        await writeConfig(cwd, ConfigSchema.parse(updated));
        logger.info("starter_complete.flipped", { scanId });
      } catch (err) {
        // Config write failure shouldn't fail the scan.
        logger.warn("starter_complete.write_failed", {
          error: (err as Error).message,
        });
      }
    }

    return {
      scanId,
      issues,
      scan,
      filesScanned: files.length,
      scannedPath: cwd,
    };
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
