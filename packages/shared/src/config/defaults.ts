import type { Config, Language, Framework } from "./schema.js";

export interface DefaultsInput {
  projectName: string;
  languages: Language[];
  frameworks?: Framework[];
  repo?: string;
}

export function buildDefaultConfig(input: DefaultsInput): Config {
  return {
    version: "0.5",
    project: {
      name: input.projectName,
      primary_languages: input.languages,
      frameworks: input.frameworks ?? [],
    },
    ai: {
      primary_provider: "claude-api",
      model: "claude-opus-4-7",
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
  };
}
