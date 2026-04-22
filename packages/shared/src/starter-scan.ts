/**
 * The "starter scan" is the first run we steer new users toward. Its
 * whole point is to be *unintimidating*: a handful of fast, purely
 * static playbooks with zero runtime side-effects, so a first-time
 * user can see the tool work end-to-end without worrying that it's
 * about to send 10,000 password-reset emails or upload malware
 * fixtures to their S3 bucket.
 *
 * These ids are hand-picked to satisfy three properties:
 *   1. regex-only (type: regex → no AI required → fast)
 *   2. risk_profile: safe (no network, no process side-effects)
 *   3. high-signal (every repo tends to have at least one hit, which
 *      makes the first-scan experience feel useful rather than empty)
 *
 * The list is intentionally small. Once starter_complete flips to
 * true in config, the full catalog opens up.
 */
export const STARTER_PLAYBOOK_IDS: readonly string[] = [
  "secrets/hardcoded-secrets-scanner",
  "owasp/a03-injection/sql-injection-raw",
  "owasp/a03-injection/xss-innerhtml",
  "cwe-top-25/path-traversal",
  "iac/compose-plaintext-secrets",
] as const;

export function isStarterPlaybook(id: string): boolean {
  return STARTER_PLAYBOOK_IDS.includes(id);
}
