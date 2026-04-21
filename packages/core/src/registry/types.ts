import { z } from "zod";

/**
 * Playbook registry index format v1.
 *
 * A registry is a single JSON document hosted at a stable URL. Each entry
 * describes one playbook and the files it needs. Every file carries a
 * SHA-256 digest so the CLI can verify the bytes before writing them to
 * disk — registries are *untrusted by default*.
 *
 * This format is intentionally flat and boring so any static host
 * (GitHub Pages, S3, a plain Apache directory) can serve it.
 */
export const RegistryFileSchema = z.object({
  /** Path *inside* the playbook directory, e.g. "manifest.yml". */
  path: z.string().min(1),
  /** Absolute URL to fetch the file bytes. */
  url: z.string().url(),
  /** Lowercase hex SHA-256 of the file bytes. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const RegistryEntrySchema = z.object({
  /** Globally unique playbook id, e.g. `community/graphql-introspection`. */
  id: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+(\/[a-z0-9-]+)*$/i),
  description: z.string().min(1),
  version: z.string().min(1),
  owasp_category: z.string().optional(),
  severity_default: z
    .enum(["info", "low", "medium", "high", "critical"])
    .default("medium"),
  files: z.array(RegistryFileSchema).min(1),
  /** Optional PGP-style signature (detached, base64). Reserved for v2. */
  signature: z.string().optional(),
});

export const RegistryIndexSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  /** Registry maintainer info — shown in `opt playbooks list --remote`. */
  maintainer: z
    .object({
      name: z.string(),
      url: z.string().url().optional(),
    })
    .optional(),
  playbooks: z.array(RegistryEntrySchema),
});

export type RegistryFile = z.infer<typeof RegistryFileSchema>;
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type RegistryIndex = z.infer<typeof RegistryIndexSchema>;

export class RegistryError extends Error {
  constructor(
    public readonly kind:
      | "fetch_failed"
      | "invalid_index"
      | "sha256_mismatch"
      | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "RegistryError";
  }
}
