import type { Command } from "commander";
import pc from "picocolors";

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description("Interactive setup wizard (M1 — M0 prints instructions)")
    .action(() => {
      // eslint-disable-next-line no-console
      console.log(pc.bold("Oh Pen Testing setup — M0"));
      // eslint-disable-next-line no-console
      console.log("The web setup wizard ships in M1. For M0:");
      // eslint-disable-next-line no-console
      console.log("");
      // eslint-disable-next-line no-console
      console.log("  1. Set your Anthropic API key:");
      // eslint-disable-next-line no-console
      console.log(pc.dim("     export ANTHROPIC_API_KEY=sk-ant-..."));
      // eslint-disable-next-line no-console
      console.log(
        pc.dim(
          "     (or) security add-generic-password -s oh-pen-testing -a anthropic-api-key -w",
        ),
      );
      // eslint-disable-next-line no-console
      console.log("");
      // eslint-disable-next-line no-console
      console.log("  2. Set your GitHub PAT (scoped to your target repo):");
      // eslint-disable-next-line no-console
      console.log(pc.dim("     export GITHUB_TOKEN=ghp_..."));
      // eslint-disable-next-line no-console
      console.log(
        pc.dim(
          "     (or) security add-generic-password -s oh-pen-testing -a github-token -w",
        ),
      );
      // eslint-disable-next-line no-console
      console.log("");
      // eslint-disable-next-line no-console
      console.log("  3. Run: " + pc.cyan("oh-pen-testing init"));
    });
}
