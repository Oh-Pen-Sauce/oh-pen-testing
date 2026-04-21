import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import pc from "picocolors";
import { execa, type ResultPromise } from "execa";
import open from "open";
import { scaffold } from "@oh-pen-testing/core";
import { ohpenPaths } from "@oh-pen-testing/shared";

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description("Launch the local setup wizard (web UI on 127.0.0.1:7676)")
    .option("--no-open", "Don't auto-open the browser")
    .action(async (opts: { open?: boolean }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const paths = ohpenPaths(cwd);

      // Scaffold if needed so the web app has a config.yml to edit
      await scaffold({ cwd });

      const webPkgDir = resolveWebPackageDir();

      // eslint-disable-next-line no-console
      console.log(pc.bold("▶ Starting setup wizard at http://127.0.0.1:7676/setup"));
      // eslint-disable-next-line no-console
      console.log(pc.dim(`  (Ctrl-C to stop. Config will be written to ${paths.config})`));

      const env = {
        ...process.env,
        OHPEN_CWD: cwd,
        PORT: "7676",
        HOSTNAME: "127.0.0.1",
      };

      const child: ResultPromise = execa("pnpm", ["start"], {
        cwd: webPkgDir,
        env,
        stdio: "inherit",
      });

      // Forward SIGINT / SIGTERM to the child
      const cleanup = () => {
        child.kill("SIGTERM");
      };
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      // Give the server a moment to boot, then open the browser
      if (opts.open !== false) {
        setTimeout(() => {
          open("http://127.0.0.1:7676/setup").catch(() => {
            // eslint-disable-next-line no-console
            console.log(
              pc.yellow("Couldn't auto-open browser. Visit http://127.0.0.1:7676/setup"),
            );
          });
        }, 2000);
      }

      try {
        await child;
      } catch (err) {
        if ((err as { isCanceled?: boolean }).isCanceled) return;
        throw err;
      }
    });
}

function resolveWebPackageDir(): string {
  // Walk up from this file: packages/cli/dist/... -> root -> packages/web
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..", "web");
}
