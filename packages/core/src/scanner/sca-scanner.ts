import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Severity } from "@oh-pen-testing/shared";

const exec = promisify(execFile);

export interface ScaFinding {
  source: "npm-audit" | "pip-audit" | "bundler-audit";
  packageName: string;
  installedVersion?: string;
  vulnerabilityId: string;
  severity: Severity;
  summary: string;
  recommendation?: string;
  fixAvailable: boolean;
  file: string;
}

export interface ScaScanResult {
  findings: ScaFinding[];
  skippedSources: Array<{ source: string; reason: string }>;
}

/**
 * Runs the configured SCA tools and normalises their output.
 *
 * Skips any source whose manifest file (package.json, requirements.txt,
 * Gemfile.lock) isn't in the cwd — there's no point running pip-audit on
 * a TypeScript-only repo. Also skips if the tool isn't on PATH.
 *
 * All tools are invoked with `--json` (or equivalent) and stdout is parsed.
 * Non-zero exit is expected when findings exist; we still parse stdout.
 */
export async function runScaScan(
  cwd: string,
  sources: ReadonlyArray<"npm-audit" | "pip-audit" | "bundler-audit">,
): Promise<ScaScanResult> {
  const findings: ScaFinding[] = [];
  const skipped: Array<{ source: string; reason: string }> = [];

  for (const source of sources) {
    try {
      if (source === "npm-audit") {
        const has = await fileExists(path.join(cwd, "package.json"));
        if (!has) {
          skipped.push({ source, reason: "no package.json" });
          continue;
        }
        const batch = await runNpmAudit(cwd);
        findings.push(...batch);
      } else if (source === "pip-audit") {
        const has =
          (await fileExists(path.join(cwd, "requirements.txt"))) ||
          (await fileExists(path.join(cwd, "pyproject.toml"))) ||
          (await fileExists(path.join(cwd, "setup.py")));
        if (!has) {
          skipped.push({ source, reason: "no python manifest" });
          continue;
        }
        const batch = await runPipAudit(cwd);
        findings.push(...batch);
      } else if (source === "bundler-audit") {
        const has = await fileExists(path.join(cwd, "Gemfile.lock"));
        if (!has) {
          skipped.push({ source, reason: "no Gemfile.lock" });
          continue;
        }
        const batch = await runBundlerAudit(cwd);
        findings.push(...batch);
      }
    } catch (err) {
      skipped.push({
        source,
        reason: `tool failed: ${(err as Error).message}`,
      });
    }
  }

  return { findings, skippedSources: skipped };
}

async function runNpmAudit(cwd: string): Promise<ScaFinding[]> {
  let raw: string;
  try {
    const res = await exec("npm", ["audit", "--json"], {
      cwd,
      maxBuffer: 50 * 1024 * 1024,
    });
    raw = res.stdout;
  } catch (err) {
    // npm audit exits 1 when findings exist; still emits JSON on stdout
    const e = err as { stdout?: string };
    if (!e.stdout) throw err;
    raw = e.stdout;
  }
  const parsed = JSON.parse(raw) as {
    vulnerabilities?: Record<
      string,
      {
        name: string;
        severity: string;
        via?: Array<string | { title?: string; url?: string; source?: number }>;
        range?: string;
        fixAvailable?: boolean | { name: string; version: string; isSemVerMajor: boolean };
      }
    >;
  };
  const out: ScaFinding[] = [];
  for (const vuln of Object.values(parsed.vulnerabilities ?? {})) {
    const primaryVia = (vuln.via ?? [])
      .map((v) => (typeof v === "string" ? null : v))
      .find((v) => v !== null) as
      | { title?: string; url?: string; source?: number }
      | undefined;
    out.push({
      source: "npm-audit",
      packageName: vuln.name,
      installedVersion: vuln.range,
      vulnerabilityId: primaryVia?.url ?? `npm:${vuln.name}`,
      severity: normaliseSeverity(vuln.severity),
      summary: primaryVia?.title ?? `Vulnerability in ${vuln.name}`,
      fixAvailable: Boolean(vuln.fixAvailable),
      file: "package.json",
    });
  }
  return out;
}

interface PipAuditEntry {
  name: string;
  version: string;
  vulns?: Array<{
    id: string;
    fix_versions?: string[];
    description?: string;
  }>;
}

async function runPipAudit(cwd: string): Promise<ScaFinding[]> {
  let raw: string;
  try {
    const res = await exec("pip-audit", ["--format", "json"], {
      cwd,
      maxBuffer: 50 * 1024 * 1024,
    });
    raw = res.stdout;
  } catch (err) {
    const e = err as { stdout?: string };
    if (!e.stdout) throw err;
    raw = e.stdout;
  }
  let entries: PipAuditEntry[] = [];
  try {
    const parsed = JSON.parse(raw);
    // pip-audit 2.x emits { dependencies: [...] }, older emits [...]
    entries = Array.isArray(parsed) ? parsed : parsed.dependencies ?? [];
  } catch {
    return [];
  }
  const out: ScaFinding[] = [];
  for (const entry of entries) {
    for (const vuln of entry.vulns ?? []) {
      out.push({
        source: "pip-audit",
        packageName: entry.name,
        installedVersion: entry.version,
        vulnerabilityId: vuln.id,
        severity: "high", // pip-audit doesn't emit severity; default conservative
        summary: vuln.description ?? `Vulnerability ${vuln.id} in ${entry.name}`,
        recommendation:
          vuln.fix_versions && vuln.fix_versions.length > 0
            ? `Upgrade to ${vuln.fix_versions.join(" or ")}`
            : undefined,
        fixAvailable: Boolean(vuln.fix_versions && vuln.fix_versions.length > 0),
        file: "requirements.txt",
      });
    }
  }
  return out;
}

async function runBundlerAudit(cwd: string): Promise<ScaFinding[]> {
  let raw: string;
  try {
    const res = await exec("bundle", ["audit", "check", "--format", "json"], {
      cwd,
      maxBuffer: 50 * 1024 * 1024,
    });
    raw = res.stdout;
  } catch (err) {
    const e = err as { stdout?: string };
    if (!e.stdout) throw err;
    raw = e.stdout;
  }
  let results: Array<{
    type: string;
    gem: string;
    version?: string;
    advisory: {
      id: string;
      title: string;
      criticality?: string;
      patched_versions?: string[];
    };
  }> = [];
  try {
    const parsed = JSON.parse(raw);
    results = parsed.results ?? parsed ?? [];
  } catch {
    return [];
  }
  const out: ScaFinding[] = [];
  for (const r of results) {
    if (r.type !== "unpatched_gem") continue;
    out.push({
      source: "bundler-audit",
      packageName: r.gem,
      installedVersion: r.version,
      vulnerabilityId: r.advisory.id,
      severity: normaliseSeverity(r.advisory.criticality ?? "high"),
      summary: r.advisory.title,
      recommendation:
        r.advisory.patched_versions && r.advisory.patched_versions.length > 0
          ? `Upgrade to ${r.advisory.patched_versions.join(" or ")}`
          : undefined,
      fixAvailable: Boolean(
        r.advisory.patched_versions && r.advisory.patched_versions.length > 0,
      ),
      file: "Gemfile.lock",
    });
  }
  return out;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function normaliseSeverity(raw: string): Severity {
  const s = raw.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "moderate" || s === "medium") return "medium";
  if (s === "low") return "low";
  return "info";
}
