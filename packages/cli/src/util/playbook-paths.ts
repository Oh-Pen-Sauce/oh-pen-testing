import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the bundled playbooks root.
 *
 * In development (tsup dev) and when running from `dist/`, the playbooks live
 * at `<repo>/playbooks/core` relative to the workspace root. We walk up from
 * the CLI's compiled file.
 */
export function resolveBundledPlaybooksRoot(): string {
  const here = fileURLToPath(import.meta.url);
  // `dist/index.js` -> walk up to packages/cli -> up to repo root
  const candidates = [
    path.resolve(here, "../../../../playbooks/core"),
    path.resolve(here, "../../../../../playbooks/core"),
    path.resolve(process.cwd(), "playbooks/core"),
  ];
  // Best-effort: return the first plausible candidate; the loader handles missing dirs
  return candidates[0]!;
}

export function resolveLocalPlaybooksRoot(cwd: string): string {
  return path.join(cwd, ".ohpentesting", "playbooks", "local");
}
