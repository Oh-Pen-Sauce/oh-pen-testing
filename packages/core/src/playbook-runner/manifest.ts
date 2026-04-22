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

/**
 * How invasive a playbook is at runtime.
 *
 *   safe       — pure static analysis on source files; no network,
 *                no process side-effects. Regex & AST playbooks.
 *   read-only  — makes outbound requests but only GETs. Cannot cause
 *                state change on the target (header probes, etc.).
 *   probe      — sends POST/PUT but the target can always safely
 *                replay; no emails sent, no persistent writes.
 *   mutating   — may cause real-world side-effects (emails sent,
 *                files uploaded, rate-limit counters incremented).
 *                These are the ones that can lock out real users if
 *                run against production.
 */
export const RiskProfileSchema = z.enum([
  "safe",
  "read-only",
  "probe",
  "mutating",
]);
export type RiskProfile = z.infer<typeof RiskProfileSchema>;

export const PlaybookManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-/]*[a-z0-9]$/),
  version: z.string(),
  category: z.enum([
    "owasp-top-10",
    "secrets",
    "sca",
    "wstg",
    "cwe-top-25",
    "iac",
    "custom",
  ]),
  owasp_ref: z.string().optional(),
  cwe: z.array(z.string()).default([]),
  severity_default: SeveritySchema,
  languages: z.array(z.string()).default(["generic"]),
  authors: z.array(z.string()).default([]),
  description: z.string().default(""),
  risky: z.boolean().default(false),
  /**
   * Risk profile — drives UI badges and whether the playbook is
   * eligible for the starter scan. Defaults to 'safe' since every
   * regex playbook that doesn't explicitly declare itself higher-risk
   * is by definition a static-only scan.
   */
  risk_profile: RiskProfileSchema.default("safe"),
  /**
   * Human-readable "what could this break" sentence. Shown in the
   * Settings → Tests catalog so users can decide whether to enable
   * the test against a given target. Optional; UI falls back to the
   * risk_profile explanation if not provided.
   */
  impact: z.string().optional(),
  requires_ai: z.boolean().default(true),
  type: z.enum(["regex", "ast", "prompt", "sca"]).default("regex"),
  rules: z.array(RegexRuleSchema).default([]),
  /** For type=sca: which external auditor(s) to invoke. */
  sca_sources: z.array(ScaSourceSchema).default([]),
});

export type PlaybookManifest = z.infer<typeof PlaybookManifestSchema>;
