## Playbook: missing-sri (scan)

Confirm when a cross-origin script/stylesheet is loaded without `integrity=`.

Do NOT confirm when:
- The resource is first-party (same origin, relative URL, or matches a documented CDN-of-ours).
- The page is HTML/email-oriented and genuinely public (e.g. a marketing doc using an analytics script) AND the operator has accepted this risk in a visible comment.

Severity:
- `high` — the script executes in an auth'd session context (admin panel, user dashboard).
- `medium` — script on a public page.
