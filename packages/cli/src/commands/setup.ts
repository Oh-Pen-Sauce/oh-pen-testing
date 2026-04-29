import path from "node:path";
import { createRequire } from "node:module";
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

      let webPkgDir: string;
      let nextBin: string;
      try {
        ({ webPkgDir, nextBin } = resolveWebRuntime());
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          pc.red(
            "Couldn't locate the bundled @oh-pen-testing/web package. " +
              "Try reinstalling the CLI: npm install -g @oh-pen-testing/cli",
          ),
        );
        // eslint-disable-next-line no-console
        console.error(pc.dim(String((err as Error).message)));
        process.exitCode = 1;
        return;
      }

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

      const child: ResultPromise = execa(
        process.execPath,
        [nextBin, "start", "-H", "127.0.0.1", "-p", "7676"],
        {
          cwd: webPkgDir,
          env,
          stdio: "inherit",
        },
      );

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

function resolveWebRuntime(): { webPkgDir: string; nextBin: string } {
  // Resolve @oh-pen-testing/web via Node module resolution. This works whether
  // the CLI is installed globally (web shipped as a runtime dep), in a local
  // node_modules, or run from the monorepo (resolves through workspace links).
  const requireFromHere = createRequire(import.meta.url);
  let webPkgJsonPath: string;
  try {
    webPkgJsonPath = requireFromHere.resolve("@oh-pen-testing/web/package.json");
  } catch {
    // Fallback for monorepo dev: walk up from this file to packages/web.
    // packages/cli/dist/<bundle>.js -> packages/cli/dist -> packages/cli -> packages -> packages/web
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidate = path.resolve(here, "..", "..", "..", "web", "package.json");
    webPkgJsonPath = candidate;
  }
  const webPkgDir = path.dirname(webPkgJsonPath);

  // Resolve the `next` CLI from the web package's own dependency graph so we
  // run the version pinned by web, regardless of hoisting.
  const requireFromWeb = createRequire(webPkgJsonPath);
  const nextBin = requireFromWeb.resolve("next/dist/bin/next");

  return { webPkgDir, nextBin };
}
