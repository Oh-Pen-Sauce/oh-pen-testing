import type { Config, Language, Framework, ProviderId } from "./schema.js";

export interface DefaultsInput {
  projectName: string;
  languages: Language[];
  frameworks?: Framework[];
  repo?: string;
  /** Optional hint from the init scaffolder about which provider to default to. */
  preferredProvider?: ProviderId;
}

export function buildDefaultConfig(input: DefaultsInput): Config {
  const provider: ProviderId = input.preferredProvider ?? "claude-code-cli";
  const model =
    provider === "ollama"
      ? "kimi-k2.6"
      : provider === "claude-code-cli"
        ? "claude-sonnet-4-6"
        : "claude-opus-4-7";
  return {
    version: "0.5",
    project: {
      name: input.projectName,
      primary_languages: input.languages,
      frameworks: input.frameworks ?? [],
    },
    ai: {
      primary_provider: provider,
      model,
      rate_limit: {
        strategy: "auto",
        budget_usd: 5.0,
      },
    },
    git: {
      host: "github",
      repo: input.repo ?? "owner/name",
      default_branch: "main",
    },
    agents: {
      autonomy: "recommended",
      parallelism: 4,
      approval_triggers: [
        "auth_changes",
        "secrets_rotation",
        "schema_migrations",
        "large_diff",
      ],
    },
    scope: {
      authorisation_acknowledged: false,
      authorisation_acknowledged_at: null,
      authorisation_acknowledged_by: null,
      allowed_targets: [],
      time_windows: [],
      rate_limits: {
        default: { requests_per_minute: 60, max_concurrent: 4 },
      },
    },
    scans: {
      playbooks: {
        owasp_top_10: true,
        secrets: true,
        sca: true,
        wstg_core: false,
        cwe_top_25: false,
      },
      risky: {},
    },
    reports: {
      formats: ["markdown", "json"],
    },
    telemetry: {
      enabled: false,
    },
  };
}
