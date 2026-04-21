import { z } from "zod";

export const LanguageSchema = z.enum([
  "javascript",
  "typescript",
  "python",
  "java",
  "csharp",
  "go",
  "ruby",
  "php",
  "rust",
  "generic",
]);
export type Language = z.infer<typeof LanguageSchema>;

export const FrameworkSchema = z.enum([
  "react",
  "angular",
  "vue",
  "svelte",
  "nextjs",
  "vite",
  "express",
  "fastapi",
  "django",
  "flask",
  "none",
]);
export type Framework = z.infer<typeof FrameworkSchema>;

export const ProviderIdSchema = z.enum([
  "claude-api",
  "claude-max",
  "claude-code-cli",
  "openai",
  "openrouter",
  "ollama",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const AutonomyModeSchema = z.enum([
  "yolo",
  "full-yolo",
  "recommended",
  "careful",
]);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

export const SeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const GitHostSchema = z.enum(["github", "gitlab", "bitbucket"]);
export type GitHost = z.infer<typeof GitHostSchema>;

export const ApprovalTriggerSchema = z.enum([
  "auth_changes",
  "secrets_rotation",
  "schema_migrations",
  "large_diff",
]);
export type ApprovalTrigger = z.infer<typeof ApprovalTriggerSchema>;

export const ReportFormatSchema = z.enum([
  "markdown",
  "json",
  "sarif",
  "pdf",
  "sbom-cyclonedx",
  "sbom-spdx",
]);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

export const TimeWindowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  timezone: z.string().default("UTC"),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export const RateLimitProfileSchema = z.object({
  requests_per_minute: z.number().int().positive().default(60),
  max_concurrent: z.number().int().positive().default(4),
});
export type RateLimitProfile = z.infer<typeof RateLimitProfileSchema>;

export const ScopeSchema = z.object({
  /** Hard gate — no scan runs while false. Set by wizard ack or CLI prompt. */
  authorisation_acknowledged: z.boolean().default(false),
  authorisation_acknowledged_at: z.string().nullable().default(null),
  authorisation_acknowledged_by: z.string().nullable().default(null),
  /** Allowlist of paths/URLs the scanner may touch. Empty = cwd only. */
  allowed_targets: z.array(z.string()).default([]),
  /** Only scan inside these windows; empty = no restriction. */
  time_windows: z.array(TimeWindowSchema).default([]),
  /** Per-target rate limits. `default` is applied when no matching profile. */
  rate_limits: z
    .object({
      default: RateLimitProfileSchema.default({
        requests_per_minute: 60,
        max_concurrent: 4,
      }),
    })
    .default({
      default: { requests_per_minute: 60, max_concurrent: 4 },
    }),
});
export type Scope = z.infer<typeof ScopeSchema>;

export const ConfigSchema = z.object({
  version: z.literal("0.5"),
  project: z.object({
    name: z.string().min(1),
    primary_languages: z.array(LanguageSchema).min(1),
    frameworks: z.array(FrameworkSchema).default([]),
  }),
  ai: z.object({
    primary_provider: ProviderIdSchema,
    fallback_provider: ProviderIdSchema.optional(),
    model: z.string().min(1),
    rate_limit: z
      .object({
        strategy: z.enum(["auto", "chunked", "cron"]).default("auto"),
        budget_usd: z.number().nonnegative().default(5.0),
      })
      .default({ strategy: "auto", budget_usd: 5.0 }),
  }),
  git: z.object({
    host: GitHostSchema,
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be owner/name"),
    default_branch: z.string().default("main"),
  }),
  agents: z.object({
    autonomy: AutonomyModeSchema.default("recommended"),
    parallelism: z.number().int().positive().default(4),
    approval_triggers: z.array(ApprovalTriggerSchema).default([
      "auth_changes",
      "secrets_rotation",
      "schema_migrations",
      "large_diff",
    ]),
  }),
  scope: ScopeSchema.default({
    authorisation_acknowledged: false,
    authorisation_acknowledged_at: null,
    authorisation_acknowledged_by: null,
    allowed_targets: [],
    time_windows: [],
    rate_limits: {
      default: { requests_per_minute: 60, max_concurrent: 4 },
    },
  }),
  scans: z.object({
    playbooks: z
      .object({
        owasp_top_10: z.boolean().default(true),
        secrets: z.boolean().default(true),
        sca: z.boolean().default(true),
        wstg_core: z.boolean().default(false),
        cwe_top_25: z.boolean().default(false),
      })
      .default({
        owasp_top_10: true,
        secrets: true,
        sca: true,
        wstg_core: false,
        cwe_top_25: false,
      }),
    risky: z.record(z.string(), z.boolean()).default({}),
  }),
  reports: z
    .object({
      formats: z.array(ReportFormatSchema).default(["markdown", "json"]),
    })
    .default({ formats: ["markdown", "json"] }),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  constructor(message: string, public readonly issues?: unknown) {
    super(message);
    this.name = "ConfigError";
  }
}

export type ScopeViolationKind =
  | "authorisation_not_acknowledged"
  | "outside_time_window"
  | "target_not_allowed"
  | "rate_limit_exceeded";

export class ScopeViolation extends Error {
  constructor(
    public readonly kind: ScopeViolationKind,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ScopeViolation";
  }
}
