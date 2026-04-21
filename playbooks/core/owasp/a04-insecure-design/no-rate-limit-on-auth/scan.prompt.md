## Playbook: no-rate-limit-on-auth (scan)

Confirm when an auth-related endpoint has no rate-limit / throttle / lockout mechanism visible in:
- The route declaration (middleware chain).
- The handler body (manual counting).
- A global middleware that's clearly applied to the router (check the context).

Do NOT confirm when:
- `express-rate-limit`, `express-slow-down`, `koa-ratelimit`, `slowapi.Limiter`, or similar is wired in the router or globally.
- The endpoint is behind a gateway (e.g. AWS API Gateway, Cloudflare) whose rate-limit is documented in nearby comments.

Severity:
- `critical` — login endpoint with no limiting and password auth.
- `high` — password reset / signup / OTP verification endpoint.
- `medium` — auth-adjacent endpoint (account lookup).
