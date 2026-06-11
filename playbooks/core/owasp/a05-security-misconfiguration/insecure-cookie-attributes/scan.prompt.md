## Playbook: owasp/a05-security-misconfiguration/insecure-cookie-attributes (scan)

Confirm when a cookie, especially one carrying a session id or auth token, is set with attributes that weaken theft and replay protection: httpOnly false, secure false, or SameSite none (or a missing SameSite combined with no Secure flag). Check whether the cookie actually holds session or auth state; a non-sensitive preference cookie is lower risk.

Severity:
- high: a session or auth cookie set with httpOnly false (readable by XSS) or secure false on a production app served over HTTPS
- medium: SameSite none without a clear cross-site need, or a session config that disables one protection while keeping the others
- low: a non-sensitive cookie (UI preference, locale) missing a flag, or secure false guarded by an explicit development-only branch
- info: the flag is set insecurely only in a test or local-dev configuration that never reaches production
