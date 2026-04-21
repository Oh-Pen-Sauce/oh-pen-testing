import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Command } from "commander";
import pc from "picocolors";

const exec = promisify(execFile);

const LAUNCHD_LABEL = "com.ohpensauce.pentesting.nightly";
const CRON_SENTINEL = "# oh-pen-testing nightly";

export function registerSchedule(program: Command): void {
  program
    .command("schedule")
    .description("Schedule nightly scans (launchd on macOS, crontab on Linux)")
    .option("--nightly", "Install nightly scan at 02:00 local")
    .option("--remove", "Remove the installed schedule")
    .action(async (opts: { nightly?: boolean; remove?: boolean }, cmd) => {
      const cwd: string = cmd.parent?.opts().cwd ?? process.cwd();
      if (!opts.nightly && !opts.remove) {
        // eslint-disable-next-line no-console
        console.log(
          pc.yellow("Pass --nightly to install or --remove to uninstall."),
        );
        return;
      }
      if (process.platform === "darwin") {
        if (opts.remove) {
          await removeLaunchd();
          // eslint-disable-next-line no-console
          console.log(pc.green("✔ Removed launchd entry"));
        } else {
          await installLaunchd(cwd);
          // eslint-disable-next-line no-console
          console.log(pc.green("✔ Installed launchd entry (02:00 local)"));
        }
      } else {
        if (opts.remove) {
          await removeCron();
          // eslint-disable-next-line no-console
          console.log(pc.green("✔ Removed cron entry"));
        } else {
          await installCron(cwd);
          // eslint-disable-next-line no-console
          console.log(pc.green("✔ Installed cron entry (02:00 local)"));
        }
      }
    });
}

function launchdPlistPath(): string {
  return path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${LAUNCHD_LABEL}.plist`,
  );
}

async function installLaunchd(cwd: string): Promise<void> {
  const plistPath = launchdPlistPath();
  const cliEntry = process.argv[1] ?? "";
  const wrapperArgs = cliEntry
    ? [process.execPath, cliEntry]
    : [process.execPath];
  const body = launchdPlistBodyFromArgs(cwd, wrapperArgs);
  await fs.mkdir(path.dirname(plistPath), { recursive: true });
  const existing = await readIfExists(plistPath);
  if (existing === body) return; // idempotent
  await fs.writeFile(plistPath, body, "utf-8");
  try {
    await exec("launchctl", ["unload", plistPath]);
  } catch {
    /* first-time install */
  }
  await exec("launchctl", ["load", "-w", plistPath]);
}

function launchdPlistBodyFromArgs(cwd: string, args: string[]): string {
  const logPath = path.join(cwd, ".ohpentesting", "logs", "cron.log");
  const argsXml = args
    .map((a) => `    <string>${xmlEscape(a)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argsXml}
    <string>scan</string>
    <string>--cwd</string>
    <string>${xmlEscape(cwd)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(cwd)}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath)}</string>
</dict>
</plist>
`;
}

function xmlEscape(s: string): string {
  return s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
}

async function removeLaunchd(): Promise<void> {
  const plistPath = launchdPlistPath();
  try {
    await exec("launchctl", ["unload", plistPath]);
  } catch {
    /* already unloaded */
  }
  try {
    await fs.unlink(plistPath);
  } catch {
    /* already gone */
  }
}

async function installCron(cwd: string): Promise<void> {
  const cliEntry = process.argv[1] ?? "";
  const logPath = path.join(cwd, ".ohpentesting", "logs", "cron.log");
  const command = `cd ${shEscape(cwd)} && ${shEscape(process.execPath)} ${shEscape(cliEntry)} scan >> ${shEscape(logPath)} 2>&1`;
  const entry = `${CRON_SENTINEL}\n0 2 * * * ${command}`;
  const current = await getCrontab();
  if (current.includes(CRON_SENTINEL)) return; // idempotent
  const next = current.trimEnd() + "\n" + entry + "\n";
  await writeCrontab(next);
}

async function removeCron(): Promise<void> {
  const current = await getCrontab();
  if (!current.includes(CRON_SENTINEL)) return;
  const lines = current.split("\n");
  const out: string[] = [];
  let skipNext = false;
  for (const line of lines) {
    if (line.trim() === CRON_SENTINEL) {
      skipNext = true;
      continue;
    }
    if (skipNext) {
      skipNext = false;
      continue;
    }
    out.push(line);
  }
  await writeCrontab(out.join("\n"));
}

async function getCrontab(): Promise<string> {
  try {
    const { stdout } = await exec("crontab", ["-l"]);
    return stdout;
  } catch {
    return "";
  }
}

async function writeCrontab(contents: string): Promise<void> {
  const tmp = path.join(os.tmpdir(), `.ohpen-crontab-${Date.now()}`);
  await fs.writeFile(tmp, contents, "utf-8");
  try {
    await exec("crontab", [tmp]);
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch {
    return undefined;
  }
}

function shEscape(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}
