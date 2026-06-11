## Playbook: owasp/a01-broken-access-control/csrf-protection-missing (scan)

Confirm when a state-changing app (cookie or session auth, plus POST/PUT/PATCH/DELETE routes) weakens or removes CSRF protection. The concrete tells: a session cookie set with `sameSite: 'none'` or `sameSite: false`, or a csurf/csrf middleware whose `ignoreMethods` lists a state-changing verb. Check the cookie is actually a session or auth cookie (not a third-party widget cookie that legitimately needs cross-site delivery), and that the route surface includes unsafe verbs.

Severity:
- critical: session/auth cookie with sameSite none or false AND no token-based CSRF guard anywhere, on an app with money or admin actions
- high: sameSite weakened or POST/PUT/DELETE excused from CSRF on a normal authenticated app (the default)
- medium: sameSite none on a cookie that is genuinely needed cross-site but paired with a separate CSRF token check
- low/info: GET-only handler, or a non-session cookie where cross-site delivery is intended and no state changes
