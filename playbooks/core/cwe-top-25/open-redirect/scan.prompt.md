## Playbook: open-redirect (scan)

Confirm when the redirect target is user-controlled AND not validated against an allowlist. Severity `medium` by default; `high` when inside auth flows (post-login redirect is a phishing vector).
