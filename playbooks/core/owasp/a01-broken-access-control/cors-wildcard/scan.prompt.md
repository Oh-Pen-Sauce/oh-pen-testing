## Playbook: cors-wildcard (scan)

Verifying CORS misconfiguration candidates.

Confirm when:
- `Access-Control-Allow-Origin: *` in combination with any of: `Access-Control-Allow-Credentials: true`, cookies/tokens used for auth, CSRF reliance.
- `cors({ origin: "*" })` on an API that is not intentionally public.
- Origin header reflected directly as allow-origin without an allowlist check.

Do NOT confirm when:
- The endpoint serves genuinely public static assets (fonts, public images, public JSON) with no credentials.
- A clear allowlist check precedes the reflection (e.g. `if (ALLOWED.includes(origin)) res.setHeader(...)`).
- The wildcard is in a test mock or a docs example.

Severity:
- `critical` — wildcard + credentials + auth-reliant API.
- `high` — wildcard on authenticated API, no credentials flag.
- `medium` — reflected origin without validation on a non-auth API.
- `low` — permissive CORS on a purely public read-only endpoint.
