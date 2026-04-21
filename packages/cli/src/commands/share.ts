import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  buildShareCardSvg,
  buildShareCardText,
  listIssues,
  loadConfig,
  ohpenPaths,
  type ScanRun,
} from "@oh-pen-testing/shared";
import { CLI_VERSION } from "../index.js";

export function registerShare(program: Command): void {
  program
    .command("share")
    .description("Generate a social-share card for the latest scan")
    .option(
      "-f, --format <format>",
      "svg | text (default: svg)",
      "svg",
    )
    .option(
      "-o, --output <path>",
      "Write to a file instead of stdout",
    )
    .option(
      "--copy",
      "Also print the text version so you can copy-paste into a post",
    )
    .action(
      async (opts: { format: string; output?: string; copy?: boolean }, cmd) => {
        const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
        const config = await loadConfig(cwd);
        const paths = ohpenPaths(cwd);
        const issues = await listIssues(cwd);
        const scan = await readLatestScan(paths.scans);
        if (!scan) {
          // eslint-disable-next-line no-console
          console.log(
            pc.yellow(
              "No scan found. Run `opt scan` first, then `opt share`.",
            ),
          );
          return;
        }

        const { linesScanned, filesScanned } = await approximateScanSize(cwd);

        const svg = buildShareCardSvg({
          projectName: config.project.name,
          scan,
          issues,
          linesScanned,
          filesScanned,
          toolVersion: CLI_VERSION,
        });
        const text = buildShareCardText({
          projectName: config.project.name,
          scan,
          issues,
          linesScanned,
          filesScanned,
          toolVersion: CLI_VERSION,
        });

        if (opts.format === "text") {
          const outPath =
            opts.output ??
            path.join(paths.reports, "oh-pen-testing-share.txt");
          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await fs.writeFile(outPath, text, "utf-8");
          // eslint-disable-next-line no-console
          console.log(pc.green(`✔ Text share card → ${outPath}`));
          // eslint-disable-next-line no-console
          console.log("\n" + text);
          return;
        }

        const outPath =
          opts.output ??
          path.join(paths.reports, "oh-pen-testing-share.svg");
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, svg, "utf-8");
        // eslint-disable-next-line no-console
        console.log(pc.green(`✔ Share card → ${outPath}`));
        // eslint-disable-next-line no-console
        console.log(
          pc.dim(
            "  Open it in a browser or image viewer. For a PNG, use `rsvg-convert` or similar.",
          ),
        );
        if (opts.copy) {
          // eslint-disable-next-line no-console
          console.log(pc.bold("\nSuggested post text:\n"));
          // eslint-disable-next-line no-console
          console.log(text);
        }
      },
    );
}

async function readLatestScan(scansDir: string): Promise<ScanRun | null> {
  try {
    const files = await fs.readdir(scansDir);
    const scans: ScanRun[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(scansDir, f), "utf-8");
        scans.push(JSON.parse(raw) as ScanRun);
      } catch {
        /* skip */
      }
    }
    scans.sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
    return scans[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Cheap approximate line / file counts for the share card. Walks the
 * filesystem respecting .gitignore via core, but avoids the per-file
 * AI work of a real scan.
 */
async function approximateScanSize(
  cwd: string,
): Promise<{ linesScanned: number; filesScanned: number }> {
  const { walkFiles } = await import("@oh-pen-testing/core");
  let files = 0;
  let lines = 0;
  for await (const f of walkFiles(cwd)) {
    files += 1;
    lines += (f.content.match(/\n/g)?.length ?? 0) + 1;
  }
  return { linesScanned: lines, filesScanned: files };
}
