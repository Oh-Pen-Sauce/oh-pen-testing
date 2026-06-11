import { describe, it, expect } from "vitest";
import { BUILTIN_SECRETS_RULES } from "./secrets.js";

function ruleById(id: string): RegExp {
  const r = BUILTIN_SECRETS_RULES.find((x) => x.id === id);
  if (!r) throw new Error(`no rule ${id}`);
  return new RegExp(r.pattern, r.flags);
}

describe("BUILTIN_SECRETS_RULES", () => {
  // One representative, obviously-fake token per detector, built to the
  // exact shape each pattern expects.
  const samples: Record<string, string> = {
    "aws-access-key-id": "AKIA" + "ABCDEFGHIJKLMNOP",
    "github-pat": "ghp_" + "a".repeat(36),
    "slack-token": "xoxb-" + "1".repeat(12),
    "private-key-header": "-----BEGIN RSA PRIVATE KEY-----",
    "stripe-secret-key": "sk_live_" + "a".repeat(24),
    "openai-api-key": "sk-" + "a".repeat(20) + "T3BlbkFJ" + "b".repeat(20),
    "google-api-key": "AIza" + "a".repeat(35),
    "gcp-service-account": '"type": "service_account"',
    "sendgrid-api-key": "SG." + "a".repeat(22) + "." + "b".repeat(43),
    "gitlab-pat": "glpat-" + "a".repeat(20),
    "npm-token": "npm_" + "a".repeat(36),
    "twilio-api-key": "SK" + "0a".repeat(16),
  };

  for (const [id, sample] of Object.entries(samples)) {
    it(`${id} matches a representative token`, () => {
      expect(ruleById(id).test(sample)).toBe(true);
    });
  }

  it("no rule matches an ordinary benign code line", () => {
    const benign = `const greeting = "hello world"; export const PORT = 3000;`;
    for (const r of BUILTIN_SECRETS_RULES) {
      const re = new RegExp(r.pattern, r.flags);
      expect(re.test(benign), `${r.id} should not match benign code`).toBe(
        false,
      );
    }
  });
});
