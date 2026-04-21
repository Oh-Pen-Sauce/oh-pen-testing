/**
 * Dynamic testing types.
 *
 * Scaffolding for real HTTP attack playbooks. v1.0 ships this framework
 * + a handful of specific playbooks; the full suite (auth bypass, session
 * fixation, CSRF chains, etc.) expands over time as community
 * contributions land.
 */

export interface DynamicTarget {
  /** Fully qualified base URL, e.g. https://staging.myapp.local */
  baseUrl: string;
  /** Optional authentication (applied to every request). */
  auth?:
    | { type: "bearer"; token: string }
    | { type: "basic"; username: string; password: string }
    | { type: "cookie"; cookies: Record<string, string> };
  /** Per-request extra headers (e.g. API version). */
  headers?: Record<string, string>;
}

export interface DynamicProbeRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  path: string;
  headers?: Record<string, string>;
  body?: string | object;
  /** Don't follow redirects. Important for open-redirect / auth-bypass tests. */
  followRedirects?: boolean;
}

export interface DynamicProbeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

export interface DynamicFinding {
  playbookId: string;
  ruleId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  evidence: {
    request: DynamicProbeRequest;
    response: Pick<DynamicProbeResponse, "status" | "headers">;
    analysis: string;
  };
}

export interface DynamicPlaybookContext {
  target: DynamicTarget;
  fetch: (req: DynamicProbeRequest) => Promise<DynamicProbeResponse>;
  /** URL-allowlist is enforced *above* this function — callers can't
   * reach anything not in scope. */
  logger?: (event: string, data?: Record<string, unknown>) => void;
}

export interface DynamicPlaybook {
  id: string;
  severity_default: DynamicFinding["severity"];
  description: string;
  run(ctx: DynamicPlaybookContext): Promise<DynamicFinding[]>;
}
