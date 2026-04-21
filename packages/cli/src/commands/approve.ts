import os from "node:os";
import type { Command } from "commander";
import pc from "picocolors";
import { approveGatedIssue } from "@oh-pen-testing/core";

export function registerApprove(program: Command): void {
  program
    .command("approve")
    .description("Approve a pending-approval issue so agents can remediate it")
    .requiredOption("-i, --issue <id>", "Issue ID (e.g. ISSUE-042)")
    .option("--as <name>", "Approver name recorded on the issue", os.userInfo().username)
    .action(async (opts: { issue: string; as: string }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const issue = await approveGatedIssue(cwd, opts.issue, opts.as);
      // eslint-disable-next-line no-console
      console.log(
        pc.green(`✔ ${issue.id} approved (by ${opts.as}) → status: ${issue.status}`),
      );
      // eslint-disable-next-line no-console
      console.log(
        pc.dim(
          `  Run \`opt remediate --issue ${issue.id}\` or \`opt remediate --all\` to have an agent pick it up.`,
        ),
      );
    });
}
