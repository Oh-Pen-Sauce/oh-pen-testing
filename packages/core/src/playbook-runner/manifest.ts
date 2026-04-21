import { z } from "zod";
import { SeveritySchema } from "@oh-pen-testing/shared";

export const RegexRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  pattern: z.string(),
  flags: z.string().default(""),
  /** If true, this rule's hits will be AI-confirmed before becoming issues. */
  require_ai_confirm: z.boolean().default(true),
});
export type RegexRule = z.infer<typeof RegexRuleSchema>;

export const ScaSourceSchema = z.enum([
  "npm-audit",
  "pip-audit",
  "bundler-audit",
]);
export type ScaSource = z.infer<typeof ScaSourceSchema>;

export const PlaybookManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-/]*[a-z0-9]$/),
  version: z.string(),
  category: z.enum([
    "owasp-top-10",
    "secrets",
    "sca",
    "wstg",
    "cwe-top-25",
    "custom",
  ]),
  owasp_ref: z.string().optional(),
  cwe: z.array(z.string()).default([]),
  severity_default: SeveritySchema,
  languages: z.array(z.string()).default(["generic"]),
  authors: z.array(z.string()).default([]),
  description: z.string().default(""),
  risky: z.boolean().default(false),
  requires_ai: z.boolean().default(true),
  type: z.enum(["regex", "ast", "prompt", "sca"]).default("regex"),
  rules: z.array(RegexRuleSchema).default([]),
  /** For type=sca: which external auditor(s) to invoke. */
  sca_sources: z.array(ScaSourceSchema).default([]),
});

export type PlaybookManifest = z.infer<typeof PlaybookManifestSchema>;
