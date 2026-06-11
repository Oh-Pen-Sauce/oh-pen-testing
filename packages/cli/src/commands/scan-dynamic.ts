import type { Command } from "commander";
import pc from "picocolors";
import {
  allocateIssueId,
  allocateScanId,
  loadConfig,
  ScopeViolation,
  writeIssue,
  writeScan,
  type ScanRun,
} from "@oh-pen-testing/shared";
import {
  BUNDLED_DYNAMIC_PLAYBOOKS,
  buildDynamicIssue,
  runDynamicScan,
  type DynamicFinding,
} from "@oh-pen-testing/core";

export function registerScanDynamic(program: Command): void {
  program
    .command("scan-dynamic")
    .description(
      "Run dynamic playbooks against a deployed target (v1.0). The target origin MUST be in scope.allowed_targets.",
    )
    .requiredOption("--url <url>", "Target base URL, e.g. https://staging.myapp.local")
    .option("--bearer <token>", "Bearer token for authenticated tests")
    .action(async (opts: { url: string; bearer?: string }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);

      try {
        // eslint-disable-next-line no-console
        console.log(
          pc.bold(`▶ Dynamic scan against ${opts.url} (${BUNDLED_DYNAMIC_PLAYBOOKS.length} playbooks)`),
        );
        const findings = await runDynamicScan(
          config,
          {
            baseUrl: opts.url,
            auth: opts.bearer
              ? { type: "bearer", token: opts.bearer }
              : undefined,
          },
          BUNDLED_DYNAMIC_PLAYBOOKS,
        );

        const scanId = await allocateScanId(cwd);
        const nowIso = new Date().toISOString();
        const scan: ScanRun = {
          id: scanId,
          started_at: nowIso,
          ended_at: nowIso,
          triggered_by: "cli",
          playbooks_run: BUNDLED_DYNAMIC_PLAYBOOKS.length,
          playbooks_skipped: 0,
          issues_found: findings.length,
          issues_remediated: 0,
          ai_calls: 0,
          tokens_spent: 0,
          cost_usd: 0,
          provider: "dynamic-http",
          checkpoint: null,
          status: "completed",
        };
        await writeScan(cwd, scan);

        for (const f of findings) {
          await persistDynamicFinding(cwd, scan, f);
        }

        // eslint-disable-next-line no-console
        console.log(
          pc.green(`\n✔ Dynamic scan ${scanId} complete: ${findings.length} finding(s)`),
        );
        for (const f of findings) {
          const colour = f.severity === "critical" || f.severity === "high"
            ? pc.red
            : f.severity === "medium"
              ? pc.yellow
              : pc.blue;
          // eslint-disable-next-line no-console
          console.log(`  ${colour(`[${f.severity.toUpperCase()}]`)} ${f.title}`);
        }
      } catch (err) {
        if (err instanceof ScopeViolation) {
          // eslint-disable-next-line no-console
          console.error(pc.red(`\n✖ Scope violation (${err.kind}):`));
          // eslint-disable-next-line no-console
          console.error(pc.dim(`  ${err.message}`));
          process.exitCode = 3;
          return;
        }
        throw err;
      }
    });
}

async function persistDynamicFinding(
  cwd: string,
  scan: ScanRun,
  finding: DynamicFinding,
): Promise<void> {
  const issueId = await allocateIssueId(cwd);
  const issue = buildDynamicIssue(
    finding,
    scan.id,
    issueId,
    new Date().toISOString(),
  );
  await writeIssue(cwd, issue);
}
