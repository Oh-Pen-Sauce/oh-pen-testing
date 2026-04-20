import type { RegexRule } from "../manifest.js";

/**
 * The canonical built-in secrets ruleset for M0.
 *
 * Rules are intentionally conservative on false-positive rate. The AI
 * confirmation step is trusted to filter the `generic-high-entropy-api-key`
 * hits which have a higher FP rate.
 *
 * The manifest.yml for the hardcoded-secrets-scanner playbook references
 * these rule IDs via `rules:` but the executable patterns live here.
 */
export const BUILTIN_SECRETS_RULES: RegexRule[] = [
  {
    id: "aws-access-key-id",
    description: "AWS Access Key ID (AKIA-prefixed).",
    pattern: "\\bAKIA[0-9A-Z]{16}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "aws-secret-access-key",
    description:
      "AWS Secret Access Key (40-char base64-ish literal near secret-like label).",
    pattern:
      "(?:aws_?secret_?access_?key|aws[._-]?secret)['\"\\s:=]{1,8}['\"]([A-Za-z0-9/+=]{40})['\"]",
    flags: "gi",
    require_ai_confirm: true,
  },
  {
    id: "github-pat",
    description: "GitHub Personal Access Token (ghp_/gho_/ghu_/ghs_/ghr_).",
    pattern: "\\bgh[pous]_[A-Za-z0-9]{36,}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "slack-token",
    description: "Slack OAuth token (xoxb-/xoxp-/xoxa-/xoxr-/xoxs-).",
    pattern: "\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "private-key-header",
    description: "PEM private key header.",
    pattern: "-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    flags: "g",
    require_ai_confirm: false,
  },
  {
    id: "generic-high-entropy-api-key",
    description:
      "Labelled assignment of a high-entropy string (api_key/secret/token).",
    pattern:
      "(?:api[_-]?key|secret|token)\\s*[=:]\\s*['\"]([A-Za-z0-9/_+=-]{24,})['\"]",
    flags: "gi",
    require_ai_confirm: true,
  },
];

export function getBuiltinRules(playbookId: string): RegexRule[] {
  if (playbookId === "secrets/hardcoded-secrets-scanner") {
    return BUILTIN_SECRETS_RULES;
  }
  return [];
}
