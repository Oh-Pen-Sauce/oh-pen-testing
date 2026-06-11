## Playbook: owasp/a07-auth-failures/missing-authentication (scan)

Confirm when a sensitive route (an admin, internal, or debug path, or any state-changing handler on privileged data) runs with no authentication or authorisation check, and the handler performs a privileged action.

Check the surrounding context, not just the match:
- Is there auth applied at the router level instead (e.g. `router.use(requireAuth)` above the route, or the whole router mounted behind a guard)? If so, do NOT confirm.
- Does the handler body itself check identity (reads `req.user`, calls `verifyToken`, returns 401/403 on a missing session)? If so, do NOT confirm.
- Is the path actually privileged? A route literally named `/admin` that only renders a public marketing page is a false positive.

Confirm when:
- The handler mutates or deletes data, changes roles, or exposes secrets/config, and no middleware or in-body check gates it.
- An admin or management endpoint is gated only by a comment or a `TODO: add auth`.

Severity:
- `critical`: unauthenticated route grants account takeover, privilege escalation, or arbitrary data deletion.
- `high`: unauthenticated admin/internal action with real but bounded impact (default).
- `medium`: sensitive read endpoint exposed, or a weak check exists upstream but is incomplete.
