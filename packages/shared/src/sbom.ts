import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * SBOM generators — CycloneDX 1.5 (JSON) and SPDX 2.3 (JSON).
 *
 * We don't run a full dependency-resolver here; we read package-lock.json,
 * pip's installed metadata, and Gemfile.lock to enumerate direct + transitive
 * deps. This is the pragmatic 80% — users who want cryptographic
 * verification of the SBOM can pipe it through cosign / sigstore.
 */

export interface SbomComponent {
  name: string;
  version: string;
  ecosystem: "npm" | "pypi" | "rubygems" | "unknown";
  licenses?: string[];
  purl: string;
}

export async function collectComponents(cwd: string): Promise<SbomComponent[]> {
  const out: SbomComponent[] = [];
  out.push(...(await collectFromNpm(cwd)));
  out.push(...(await collectFromPython(cwd)));
  out.push(...(await collectFromRuby(cwd)));
  return out;
}

async function collectFromNpm(cwd: string): Promise<SbomComponent[]> {
  const lockPath = path.join(cwd, "package-lock.json");
  const raw = await readIfExists(lockPath);
  if (!raw) return [];
  try {
    const lock = JSON.parse(raw) as {
      packages?: Record<string, { version?: string; license?: string }>;
    };
    const out: SbomComponent[] = [];
    for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
      if (!pkgPath || pkgPath === "") continue;
      const name = pkgPath.replace(/^node_modules\//, "");
      if (!meta.version) continue;
      out.push({
        name,
        version: meta.version,
        ecosystem: "npm",
        licenses: meta.license ? [meta.license] : undefined,
        purl: `pkg:npm/${encodeURIComponent(name)}@${meta.version}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function collectFromPython(cwd: string): Promise<SbomComponent[]> {
  // Best-effort: parse requirements.txt. For full resolution users should
  // run pip-tools and commit requirements.lock.
  const req = await readIfExists(path.join(cwd, "requirements.txt"));
  if (!req) return [];
  const out: SbomComponent[] = [];
  for (const line of req.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const match = trimmed.match(/^([\w.\-]+)\s*==\s*([\w.\-+]+)/);
    if (!match) continue;
    const [, name, version] = match;
    out.push({
      name: name!,
      version: version!,
      ecosystem: "pypi",
      purl: `pkg:pypi/${encodeURIComponent(name!)}@${version}`,
    });
  }
  return out;
}

async function collectFromRuby(cwd: string): Promise<SbomComponent[]> {
  const lock = await readIfExists(path.join(cwd, "Gemfile.lock"));
  if (!lock) return [];
  const out: SbomComponent[] = [];
  const specsIdx = lock.indexOf("GEM\n  remote:");
  if (specsIdx === -1) return out;
  const specsSection = lock.slice(specsIdx);
  const endIdx = specsSection.indexOf("PLATFORMS");
  const specsBody = endIdx === -1 ? specsSection : specsSection.slice(0, endIdx);
  for (const line of specsBody.split("\n")) {
    const match = line.match(/^\s{4}([\w-]+)\s+\(([\w.]+)\)/);
    if (!match) continue;
    const [, name, version] = match;
    out.push({
      name: name!,
      version: version!,
      ecosystem: "rubygems",
      purl: `pkg:gem/${encodeURIComponent(name!)}@${version}`,
    });
  }
  return out;
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf-8");
  } catch {
    return undefined;
  }
}

export interface BuildSbomInput {
  cwd: string;
  projectName: string;
  toolVersion: string;
}

export async function buildCycloneDx(input: BuildSbomInput): Promise<string> {
  const components = await collectComponents(input.cwd);
  const sbom = {
    $schema: "http://cyclonedx.org/schema/bom-1.5.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    serialNumber: `urn:uuid:${makeUuid()}`,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: "Oh Pen Sauce",
          name: "Oh Pen Testing",
          version: input.toolVersion,
        },
      ],
      component: {
        type: "application",
        name: input.projectName,
      },
    },
    components: components.map((c) => ({
      type: "library",
      name: c.name,
      version: c.version,
      purl: c.purl,
      licenses: c.licenses?.map((l) => ({ license: { id: l } })),
    })),
  };
  return JSON.stringify(sbom, null, 2);
}

export async function buildSpdx(input: BuildSbomInput): Promise<string> {
  const components = await collectComponents(input.cwd);
  const doc = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${input.projectName}-sbom`,
    documentNamespace: `urn:uuid:${makeUuid()}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: [
        `Tool: Oh Pen Testing v${input.toolVersion}`,
        "Organization: Oh Pen Sauce",
      ],
    },
    packages: [
      {
        SPDXID: "SPDXRef-Package-root",
        name: input.projectName,
        downloadLocation: "NOASSERTION",
        filesAnalyzed: false,
      },
      ...components.map((c) => ({
        SPDXID: `SPDXRef-Package-${slugify(c.ecosystem)}-${slugify(c.name)}`,
        name: c.name,
        versionInfo: c.version,
        downloadLocation: "NOASSERTION",
        licenseConcluded: c.licenses?.join(" AND ") ?? "NOASSERTION",
        licenseDeclared: c.licenses?.join(" AND ") ?? "NOASSERTION",
        externalRefs: [
          {
            referenceCategory: "PACKAGE-MANAGER",
            referenceType: "purl",
            referenceLocator: c.purl,
          },
        ],
      })),
    ],
  };
  return JSON.stringify(doc, null, 2);
}

function makeUuid(): string {
  // crypto.randomUUID would work but is Node 19+ only — avoid version lock-in
  const bytes = createHash("sha256")
    .update(String(Date.now()) + Math.random())
    .digest("hex");
  return [
    bytes.slice(0, 8),
    bytes.slice(8, 12),
    "4" + bytes.slice(13, 16),
    "8" + bytes.slice(17, 20),
    bytes.slice(20, 32),
  ].join("-");
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9.-]/g, "-");
}
