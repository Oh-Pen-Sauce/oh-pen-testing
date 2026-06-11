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
    id: "stripe-secret-key",
    description: "Stripe live secret or restricted key (sk_live_/rk_live_).",
    pattern: "\\b(?:sk|rk)_live_[A-Za-z0-9]{24,}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "openai-api-key",
    description:
      "OpenAI API key (classic sk- with the T3BlbkFJ marker, or sk-proj-).",
    pattern:
      "\\bsk-(?:proj-[A-Za-z0-9_-]{40,}|[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20})\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "google-api-key",
    description: "Google API key (AIza-prefixed).",
    pattern: "\\bAIza[0-9A-Za-z_-]{35}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "gcp-service-account",
    description: "GCP service-account JSON key (type: service_account marker).",
    pattern: "\"type\"\\s*:\\s*\"service_account\"",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "sendgrid-api-key",
    description: "SendGrid API key (SG.<22>.<43>).",
    pattern: "\\bSG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "gitlab-pat",
    description: "GitLab personal access token (glpat-).",
    pattern: "\\bglpat-[A-Za-z0-9_-]{20}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "npm-token",
    description: "npm access token (npm_<36>).",
    pattern: "\\bnpm_[A-Za-z0-9]{36}\\b",
    flags: "g",
    require_ai_confirm: true,
  },
  {
    id: "twilio-api-key",
    description: "Twilio API Key SID (SK + 32 hex).",
    pattern: "\\bSK[0-9a-fA-F]{32}\\b",
    flags: "g",
    require_ai_confirm: true,
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
