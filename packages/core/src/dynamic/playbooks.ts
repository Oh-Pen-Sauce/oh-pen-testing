import type { DynamicPlaybook, DynamicFinding } from "./types.js";

/**
 * Bundled dynamic playbooks — first wave of real attack-traffic probes.
 *
 * Each one issues a minimal, deterministic request pattern against the
 * target; no fuzzing, no exploit chaining. Findings require manual
 * verification but are high-signal.
 */

export const securityHeadersPlaybook: DynamicPlaybook = {
  id: "dynamic/security-headers",
  severity_default: "medium",
  description:
    "Checks for missing security headers (HSTS, X-Frame-Options, CSP, X-Content-Type-Options).",
  async run(ctx) {
    const res = await ctx.fetch({ method: "GET", path: "/" });
    const findings: DynamicFinding[] = [];
    const required: Array<{ header: string; severity: DynamicFinding["severity"] }> = [
      { header: "strict-transport-security", severity: "medium" },
      { header: "x-frame-options", severity: "medium" },
      { header: "x-content-type-options", severity: "low" },
      { header: "content-security-policy", severity: "medium" },
    ];
    for (const { header, severity } of required) {
      const present = Object.keys(res.headers).some(
        (k) => k.toLowerCase() === header,
      );
      if (!present) {
        findings.push({
          playbookId: this.id,
          ruleId: `missing-${header}`,
          severity,
          title: `Missing ${header} header`,
          evidence: {
            request: { method: "GET", path: "/" },
            response: { status: res.status, headers: res.headers },
            analysis: `Response from ${ctx.target.baseUrl}/ did not include the ${header} header.`,
          },
        });
      }
    }
    return findings;
  },
};

export const noRateLimitOnLoginPlaybook: DynamicPlaybook = {
  id: "dynamic/no-rate-limit-login",
  severity_default: "high",
  description:
    "Probes /login or /api/login with rapid incorrect passwords; reports if no 429 is returned within 10 attempts.",
  async run(ctx) {
    const findings: DynamicFinding[] = [];
    const candidatePaths = ["/login", "/api/login", "/auth/login"];
    for (const path of candidatePaths) {
      let rateLimited = false;
      let lastStatus = 0;
      for (let i = 0; i < 10; i += 1) {
        const res = await ctx.fetch({
          method: "POST",
          path,
          headers: { "Content-Type": "application/json" },
          body: { email: "test@example.com", password: `wrong-${i}` },
        });
        lastStatus = res.status;
        if (res.status === 404) break; // endpoint doesn't exist, skip
        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      }
      if (lastStatus !== 404 && !rateLimited) {
        findings.push({
          playbookId: this.id,
          ruleId: "no-429-after-10-attempts",
          severity: "high",
          title: `No rate-limiting on ${path}`,
          evidence: {
            request: { method: "POST", path, body: "{…}" },
            response: { status: lastStatus, headers: {} },
            analysis: `Sent 10 failed login attempts to ${path}; never received a 429. Password-brute-force protection is missing.`,
          },
        });
      }
    }
    return findings;
  },
};

export const openRedirectPlaybook: DynamicPlaybook = {
  id: "dynamic/open-redirect-probe",
  severity_default: "medium",
  description:
    "Tests login-redirect / next / return-to parameters with an external URL and reports if the server reflects it.",
  async run(ctx) {
    const findings: DynamicFinding[] = [];
    const attackerUrl = "https://attacker.example.invalid/";
    const paths = [
      `/login?next=${encodeURIComponent(attackerUrl)}`,
      `/?return_to=${encodeURIComponent(attackerUrl)}`,
      `/auth?redirect=${encodeURIComponent(attackerUrl)}`,
    ];
    for (const path of paths) {
      const res = await ctx.fetch({
        method: "GET",
        path,
        followRedirects: false,
      });
      const location = res.headers.location ?? res.headers.Location ?? "";
      if (
        (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307) &&
        location.includes("attacker.example.invalid")
      ) {
        findings.push({
          playbookId: this.id,
          ruleId: "reflected-open-redirect",
          severity: "medium",
          title: `Open redirect on ${path.split("?")[0]}`,
          evidence: {
            request: { method: "GET", path },
            response: { status: res.status, headers: res.headers },
            analysis: `Response Location header redirects to an unvalidated external URL.`,
          },
        });
      }
    }
    return findings;
  },
};

export const BUNDLED_DYNAMIC_PLAYBOOKS: DynamicPlaybook[] = [
  securityHeadersPlaybook,
  noRateLimitOnLoginPlaybook,
  openRedirectPlaybook,
];
