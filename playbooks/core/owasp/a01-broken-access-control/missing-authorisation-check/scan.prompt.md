## Playbook: missing-authorisation-check (scan)

You are verifying candidate findings of state-changing endpoints that lack authorisation checks.

Consider confirmed when:
- The handler is a real HTTP handler (not a library/util) and
- It mutates state (DB write, external call, side effect) OR returns sensitive data, and
- No auth middleware is applied at the route OR at a router-level prefix visible in the context, AND
- No manual `req.user` / `request.user` / session check gates the handler body.

Consider NOT confirmed when:
- The handler is clearly an intentionally-public endpoint (e.g. `/healthz`, `/metrics`, `/login`, `/signup`, webhooks validated by signature).
- The router the handler is attached to has middleware applied elsewhere (truncated context — err on `confirmed: false` when unsure).
- The endpoint is purely read-only and returns well-known public data.

Severity guidance:
- `critical` — endpoint that modifies another user's data or returns personally-identifiable information about another user.
- `high` — state-changing endpoint with no auth at all.
- `medium` — read endpoint exposing internal data that should be gated.
- `low` — plausible but unclear whether the data is sensitive.
