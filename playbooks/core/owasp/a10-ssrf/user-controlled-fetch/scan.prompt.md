## Playbook: user-controlled-fetch (scan)

Confirm when the request URL is built from user input without allowlist validation.

Do NOT confirm when:
- A `URL` parse + host allowlist precedes the fetch call and is visible.
- The fetch target is clearly a constant-path (e.g. `/api/internal/${id}`) and relative to the same origin.

Severity:
- `critical` — fetch to an arbitrary URL, deployed inside a cloud VM (the 169.254.169.254 metadata service is reachable).
- `high` — fetch to arbitrary URL in a non-cloud context.
- `medium` — fetch with a partly-controlled path component but fixed host.
