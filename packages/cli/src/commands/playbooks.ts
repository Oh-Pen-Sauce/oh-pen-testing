import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  loadConfig,
  ohpenPaths,
} from "@oh-pen-testing/shared";
import {
  fetchAllRegistryEntries,
  findRegistryEntry,
  installPlaybook,
  RegistryError,
} from "@oh-pen-testing/core";

export function registerPlaybooks(program: Command): void {
  const cmd = program
    .command("playbooks")
    .description(
      "Manage playbooks — list installed, browse registries, install remote ones.",
    );

  cmd
    .command("list")
    .description("List installed and (with --remote) available playbooks.")
    .option("--remote", "Include playbooks available in configured registries")
    .action(async (opts: { remote?: boolean }, subCmd) => {
      const cwd: string = subCmd.parent?.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);
      const paths = ohpenPaths(cwd);

      const installed = await listInstalled(paths.playbooksRemote);
      // eslint-disable-next-line no-console
      console.log(pc.bold(`\nInstalled remote playbooks (${installed.length}):`));
      if (installed.length === 0) {
        // eslint-disable-next-line no-console
        console.log(pc.dim("  (none)"));
      }
      for (const p of installed) {
        // eslint-disable-next-line no-console
        console.log(`  ${pc.cyan(p.id)} ${pc.dim(`v${p.version}`)}`);
      }

      if (opts.remote) {
        if (config.playbook_registries.length === 0) {
          // eslint-disable-next-line no-console
          console.log(
            pc.yellow(
              "\nNo registries configured. Add one under `playbook_registries:` in .ohpentesting/config.yml.",
            ),
          );
          return;
        }
        // eslint-disable-next-line no-console
        console.log(pc.bold(`\nAvailable in registries:`));
        try {
          const entries = await fetchAllRegistryEntries(
            config.playbook_registries,
          );
          const installedIds = new Set(installed.map((p) => p.id));
          for (const e of entries) {
            const installedTag = installedIds.has(e.id)
              ? pc.green(" [installed]")
              : "";
            // eslint-disable-next-line no-console
            console.log(
              `  ${pc.cyan(e.id)} ${pc.dim(`v${e.version}`)}${installedTag}`,
            );
            // eslint-disable-next-line no-console
            console.log(pc.dim(`    ${e.description}`));
            if (e.maintainer) {
              // eslint-disable-next-line no-console
              console.log(pc.dim(`    — ${e.maintainer}`));
            }
          }
        } catch (err) {
          printRegistryError(err);
          process.exitCode = 1;
        }
      }
    });

  cmd
    .command("install <id>")
    .description(
      "Install a playbook from a configured registry (SHA-256 verified).",
    )
    .action(async (id: string, subCmd) => {
      const cwd: string = subCmd.parent?.parent?.opts().cwd ?? process.cwd();
      const config = await loadConfig(cwd);
      const paths = ohpenPaths(cwd);

      if (config.playbook_registries.length === 0) {
        // eslint-disable-next-line no-console
        console.error(
          pc.red(
            "No registries configured. Add one under `playbook_registries:` in .ohpentesting/config.yml.",
          ),
        );
        process.exitCode = 2;
        return;
      }

      try {
        const entry = await findRegistryEntry(
          config.playbook_registries,
          id,
        );
        // eslint-disable-next-line no-console
        console.log(
          pc.bold(
            `▶ Installing ${pc.cyan(entry.id)} v${entry.version} from ${entry.registryUrl}`,
          ),
        );
        const dest = await installPlaybook(entry, paths.playbooksRemote);
        // eslint-disable-next-line no-console
        console.log(pc.green(`✔ Installed to ${dest}`));
        // eslint-disable-next-line no-console
        console.log(
          pc.dim(
            "  It will be picked up automatically on the next `opt scan`.",
          ),
        );
      } catch (err) {
        printRegistryError(err);
        process.exitCode = 1;
      }
    });

  cmd
    .command("remove <id>")
    .description("Remove a remote-installed playbook.")
    .action(async (id: string, subCmd) => {
      const cwd: string = subCmd.parent?.parent?.opts().cwd ?? process.cwd();
      const paths = ohpenPaths(cwd);
      const dir = path.join(paths.playbooksRemote, ...id.split("/"));
      try {
        await fs.rm(dir, { recursive: true });
        // eslint-disable-next-line no-console
        console.log(pc.green(`✔ Removed ${id}`));
      } catch {
        // eslint-disable-next-line no-console
        console.error(pc.red(`✖ Playbook '${id}' not installed.`));
        process.exitCode = 1;
      }
    });
}

async function listInstalled(
  remoteDir: string,
): Promise<Array<{ id: string; version: string }>> {
  const out: Array<{ id: string; version: string }> = [];
  async function recurse(dir: string, relParts: string[]): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const metaFile = entries.find((e) => e.isFile() && e.name === ".registry.json");
    if (metaFile) {
      try {
        const raw = await fs.readFile(path.join(dir, ".registry.json"), "utf-8");
        const meta = JSON.parse(raw) as { id: string; version: string };
        out.push({ id: meta.id, version: meta.version });
      } catch {
        /* skip */
      }
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await recurse(
          path.join(dir, entry.name),
          [...relParts, entry.name],
        );
      }
    }
  }
  await recurse(remoteDir, []);
  return out;
}

function printRegistryError(err: unknown): void {
  if (err instanceof RegistryError) {
    // eslint-disable-next-line no-console
    console.error(pc.red(`\n✖ Registry error (${err.kind}): ${err.message}`));
  } else {
    // eslint-disable-next-line no-console
    console.error(pc.red(`\n✖ ${(err as Error).message}`));
  }
}
