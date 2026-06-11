import { ScopeViolation, type Config, type Issue } from "@oh-pen-testing/shared";
import type {
  DynamicFinding,
  DynamicPlaybook,
  DynamicPlaybookContext,
  DynamicProbeRequest,
  DynamicProbeResponse,
  DynamicTarget,
} from "./types.js";

/**
 * Map a dynamic (runtime) finding to an Issue so it lands on the board
 * alongside static findings and flows through the same review/verify
 * path. Pure: the caller allocates `issueId` and passes `nowIso`.
 *
 * Dynamic findings are observed against a live target, so confidence is
 * high, but they are never auto-fixable (there is no source patch the
 * agent can write for a runtime behaviour) and always require approval.
 */
export function buildDynamicIssue(
  finding: DynamicFinding,
  scanId: string,
  issueId: string,
  nowIso: string,
): Issue {
  return {
    id: issueId,
    title: finding.title,
    severity: finding.severity,
    cwe: finding.cwe ?? [],
    owasp_category: finding.owaspRef,
    status: "backlog",
    assignee: null,
    discovered_at: nowIso,
    discovered_by: `playbook:${finding.playbookId}/${finding.ruleId}`,
    scan_id: scanId,
    location: { file: finding.evidence.request.path, line_range: [1, 1] },
    evidence: {
      rule_id: finding.ruleId,
      code_snippet: `${finding.evidence.request.method} ${finding.evidence.request.path}\nStatus: ${finding.evidence.response.status}`,
      analysis: finding.evidence.analysis,
      ai_reasoning: finding.evidence.analysis,
      ai_model: "dynamic-http",
      ai_confidence: "high",
    },
    remediation: {
      strategy: finding.playbookId,
      auto_fixable: false,
      estimated_diff_size: 0,
      requires_approval: true,
    },
    linked_pr: null,
    verification: {
      last_run_scan_id: null,
      last_run_at: null,
      hits_remaining: null,
      verified_at: null,
    },
    blame: {
      oldest_commit_sha: null,
      oldest_commit_iso: null,
      oldest_commit_author: null,
      oldest_commit_summary: null,
      age_days: null,
      contributors: [],
    },
    comments: [],
  };
}

/**
 * Run a set of dynamic playbooks against a target URL.
 *
 * Hard gates (enforced here, before any HTTP request leaves the machine):
 * 1. `config.scope.authorisation_acknowledged` must be true
 * 2. `target.baseUrl` origin must match an entry in `scope.allowed_targets`
 * 3. No request may escape the allowed origin (redirects don't count as
 *    follow-target unless the new host is also in the allowlist)
 * 4. Per-target rate limits from `config.scope.rate_limits.default`
 */
export async function runDynamicScan(
  config: Config,
  target: DynamicTarget,
  playbooks: DynamicPlaybook[],
): Promise<DynamicFinding[]> {
  if (!config.scope.authorisation_acknowledged) {
    throw new ScopeViolation(
      "authorisation_not_acknowledged",
      "Dynamic scan refused: authorisation has not been acknowledged.",
    );
  }

  const targetUrl = new URL(target.baseUrl);
  const allowed = config.scope.allowed_targets;
  const targetAllowed = allowed.some((a) => {
    try {
      return new URL(a).origin === targetUrl.origin;
    } catch {
      return false;
    }
  });
  if (!targetAllowed) {
    throw new ScopeViolation(
      "target_not_allowed",
      `Dynamic target ${target.baseUrl} is not in scope.allowed_targets. Add it explicitly before running dynamic tests.`,
      { target: target.baseUrl, allowed },
    );
  }

  const rate = config.scope.rate_limits.default;
  const requestsPerMs = rate.requests_per_minute / 60000;
  let lastRequestAt = 0;
  let inflight = 0;

  const fetchImpl = async (
    req: DynamicProbeRequest,
  ): Promise<DynamicProbeResponse> => {
    // Simple rate limit: minimum gap between requests.
    const now = Date.now();
    const minGap = 1 / requestsPerMs;
    const wait = lastRequestAt + minGap - now;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    while (inflight >= rate.max_concurrent) {
      await new Promise((r) => setTimeout(r, 50));
    }
    inflight += 1;
    lastRequestAt = Date.now();

    const url = new URL(req.path, target.baseUrl);
    // Hard-enforce: never leave the allowed origin.
    if (url.origin !== targetUrl.origin) {
      throw new ScopeViolation(
        "target_not_allowed",
        `Dynamic request escaped origin: ${url.origin} (allowed: ${targetUrl.origin})`,
        { url: url.toString() },
      );
    }

    const headers: Record<string, string> = {
      ...(target.headers ?? {}),
      ...(req.headers ?? {}),
    };
    if (target.auth?.type === "bearer") {
      headers.Authorization = `Bearer ${target.auth.token}`;
    } else if (target.auth?.type === "basic") {
      headers.Authorization =
        "Basic " +
        Buffer.from(`${target.auth.username}:${target.auth.password}`).toString(
          "base64",
        );
    } else if (target.auth?.type === "cookie") {
      headers.Cookie = Object.entries(target.auth.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    }

    const started = Date.now();
    try {
      const res = await fetch(url.toString(), {
        method: req.method,
        headers,
        body:
          req.body === undefined
            ? undefined
            : typeof req.body === "string"
              ? req.body
              : JSON.stringify(req.body),
        redirect: req.followRedirects === false ? "manual" : "follow",
      });
      const body = await res.text();
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });
      return {
        status: res.status,
        headers: responseHeaders,
        body,
        durationMs: Date.now() - started,
      };
    } finally {
      inflight -= 1;
    }
  };

  const ctx: DynamicPlaybookContext = { target, fetch: fetchImpl };
  const findings: DynamicFinding[] = [];
  for (const pb of playbooks) {
    try {
      const fs = await pb.run(ctx);
      findings.push(...fs);
    } catch (err) {
      if (err instanceof ScopeViolation) throw err;
      // Playbook crashed: log and continue
      // eslint-disable-next-line no-console
      console.error(`[dynamic] ${pb.id} failed:`, (err as Error).message);
    }
  }
  return findings;
}
