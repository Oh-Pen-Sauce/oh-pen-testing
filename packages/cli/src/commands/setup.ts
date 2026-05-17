import path from "node:path";
import http from "node:http";
import net from "node:net";
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
    .description("One-command setup: scaffolds .ohpentesting/, then opens the web wizard (default port 7676)")
    .option("--no-open", "Don't auto-open the browser")
    .option("--port <number>", "Port for the web wizard", "7676")
    .action(async (opts: { open?: boolean; port?: string }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      const paths = ohpenPaths(cwd);
      const port = parseInt(opts.port ?? "7676", 10);

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

      // Check if the port is already in use before attempting to start
      if (await isPortInUse(port)) {
        // eslint-disable-next-line no-console
        console.error(pc.red(`\n✖ Port ${port} is already in use.`));
        // eslint-disable-next-line no-console
        console.error(
          pc.dim(`  Kill the existing process (lsof -ti :${port} | xargs kill) or use --port to pick another.`),
        );
        process.exitCode = 1;
        return;
      }

      // eslint-disable-next-line no-console
      console.log(pc.bold(`▶ Starting setup wizard at http://127.0.0.1:${port}/setup`));
      // eslint-disable-next-line no-console
      console.log(pc.dim(`  (Ctrl-C to stop. Config will be written to ${paths.config})`));

      const env = {
        ...process.env,
        OHPEN_CWD: cwd,
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
      };

      const child: ResultPromise = execa(
        process.execPath,
        [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)],
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

      // Poll until the server responds (up to 30 s) then open the browser.
      // This prevents the race where the browser opens before Next.js is ready.
      if (opts.open !== false) {
        waitForServer(`http://127.0.0.1:${port}/setup`, 30_000)
          .then((ready) => {
            if (ready) {
              return open(`http://127.0.0.1:${port}/setup`);
            }
            // eslint-disable-next-line no-console
            console.log(
              pc.yellow(`Couldn't reach http://127.0.0.1:${port} after 30 s. Open it manually.`),
            );
          })
          .catch(() => {
            // eslint-disable-next-line no-console
            console.log(
              pc.yellow(`Couldn't auto-open browser. Visit http://127.0.0.1:${port}/setup`),
            );
          });
      }

      try {
        await child;
      } catch (err) {
        if ((err as { isCanceled?: boolean }).isCanceled) return;
        throw err;
      }
    });
}

/** Returns true if the port is already bound on 127.0.0.1. */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      resolve(err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Poll url every 300 ms until a 2xx/3xx response is received or maxMs elapses.
 * Uses node:http directly to avoid any fetch implementation differences.
 */
function waitForServer(url: string, maxMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + maxMs;
    function attempt() {
      http
        .get(url, (res) => {
          res.resume(); // drain the response body so the socket closes
          if (res.statusCode && res.statusCode < 400) {
            resolve(true);
          } else {
            retry();
          }
        })
        .on("error", retry);
    }
    function retry() {
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(attempt, 300);
    }
    attempt();
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
