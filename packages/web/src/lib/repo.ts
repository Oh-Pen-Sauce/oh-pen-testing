import fs from "node:fs/promises";
import path from "node:path";
import {
  loadConfig,
  listIssues as sharedListIssues,
  readIssue as sharedReadIssue,
  writeIssue as sharedWriteIssue,
  ohpenPaths,
  type Config,
  type Issue,
  type ScanRun,
} from "@oh-pen-testing/shared";
import { resolveScanTargetPath } from "./ohpen-cwd";

export async function safeLoadConfig(): Promise<Config | null> {
  try {
    return await loadConfig(await resolveScanTargetPath());
  } catch {
    return null;
  }
}

export async function listIssues(): Promise<Issue[]> {
  return sharedListIssues(await resolveScanTargetPath());
}

export async function getIssue(id: string): Promise<Issue | null> {
  try {
    return await sharedReadIssue(await resolveScanTargetPath(), id);
  } catch {
    return null;
  }
}

export async function updateIssue(issue: Issue): Promise<void> {
  await sharedWriteIssue(await resolveScanTargetPath(), issue);
}

export async function listScans(): Promise<ScanRun[]> {
  const { scans } = ohpenPaths(await resolveScanTargetPath());
  try {
    const files = await fs.readdir(scans);
    const out: ScanRun[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(scans, f), "utf-8");
        out.push(JSON.parse(raw) as ScanRun);
      } catch {
        // skip malformed
      }
    }
    return out.sort((a, b) =>
      (b.started_at ?? "").localeCompare(a.started_at ?? ""),
    );
  } catch {
    return [];
  }
}

export async function getScan(id: string): Promise<ScanRun | null> {
  const { scans } = ohpenPaths(await resolveScanTargetPath());
  try {
    const raw = await fs.readFile(path.join(scans, `${id}.json`), "utf-8");
    return JSON.parse(raw) as ScanRun;
  } catch {
    return null;
  }
}

export async function readSourceFileSlice(
  relPath: string,
  lineStart: number,
  lineEnd: number,
  context = 5,
): Promise<{ lines: string[]; startLine: number; endLine: number }> {
  const abs = path.join(await resolveScanTargetPath(), relPath);
  const raw = await fs.readFile(abs, "utf-8");
  const all = raw.split(/\r?\n/);
  const from = Math.max(1, lineStart - context);
  const to = Math.min(all.length, lineEnd + context);
  return {
    lines: all.slice(from - 1, to),
    startLine: from,
    endLine: to,
  };
}
