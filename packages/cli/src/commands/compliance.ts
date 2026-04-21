import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  buildComplianceReport,
  FRAMEWORKS,
  listIssues,
  ohpenPaths,
  renderComplianceMarkdown,
  type FrameworkId,
} from "@oh-pen-testing/shared";

export function registerCompliance(program: Command): void {
  program
    .command("compliance")
    .description(
      "Map current issues onto a compliance framework (SOC 2, ISO 27001, PCI-DSS, HIPAA, OWASP-ASVS). Scaffold — not a certified audit.",
    )
    .requiredOption(
      "-f, --framework <id>",
      "Framework id: soc2 | iso27001 | pci-dss | hipaa | owasp-asvs",
    )
    .option(
      "-o, --output <path>",
      "Write the markdown report to a file (relative to cwd)",
    )
    .action(
      async (opts: { framework: string; output?: string }, cmd) => {
        const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
        const paths = ohpenPaths(cwd);

        const frameworkId = opts.framework as FrameworkId;
        if (!(frameworkId in FRAMEWORKS)) {
          // eslint-disable-next-line no-console
          console.error(
            pc.red(
              `Unknown framework '${opts.framework}'. Available: ${Object.keys(FRAMEWORKS).join(", ")}`,
            ),
          );
          process.exitCode = 2;
          return;
        }

        const issues = await listIssues(cwd);
        const report = buildComplianceReport(frameworkId, issues);
        const markdown = renderComplianceMarkdown(report);

        const outPath = opts.output
          ? path.isAbsolute(opts.output)
            ? opts.output
            : path.join(cwd, opts.output)
          : path.join(paths.reports, `compliance-${frameworkId}.md`);

        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, markdown, "utf-8");

        // eslint-disable-next-line no-console
        console.log(pc.bold(`\n${report.framework.name}`));
        // eslint-disable-next-line no-console
        console.log(
          `  total controls:          ${report.summary.total}`,
        );
        // eslint-disable-next-line no-console
        console.log(
          pc.green(`  clean:                   ${report.summary.clean}`),
        );
        // eslint-disable-next-line no-console
        console.log(
          pc.green(
            `  with resolved findings:  ${report.summary.withResolvedFindings}`,
          ),
        );
        // eslint-disable-next-line no-console
        console.log(
          pc.yellow(
            `  with open findings:      ${report.summary.withOpenFindings}`,
          ),
        );
        // eslint-disable-next-line no-console
        console.log(pc.green(`\n✔ Compliance report → ${outPath}`));
      },
    );
}
