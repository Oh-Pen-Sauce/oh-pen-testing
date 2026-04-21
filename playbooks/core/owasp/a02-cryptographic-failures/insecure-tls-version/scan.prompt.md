## Playbook: insecure-tls-version (scan)

Confirm when:
- A production HTTPS client/server is configured to accept or use SSLv2/SSLv3/TLSv1.0/TLSv1.1.
- `rejectUnauthorized: false` in Node TLS/HTTPS client code that calls a real remote.

Do NOT confirm when:
- The code explicitly targets a known legacy enterprise system with documented compatibility constraints (comment must spell this out).
- In a test fixture or local development cert setup where the target is localhost.

Severity:
- `critical` — `rejectUnauthorized: false` in a production API client.
- `high` — TLSv1.0/1.1 in production config.
- `medium` — TLSv1.0/1.1 in a legacy path without clear justification.
