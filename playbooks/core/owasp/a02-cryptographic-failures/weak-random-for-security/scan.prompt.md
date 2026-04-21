## Playbook: weak-random-for-security (scan)

Confirm a weak-random finding when the resulting value is used as any of:
- Session ID / CSRF token / auth token
- Password reset link / invite code
- OTP / one-time code
- API key / client secret

Do NOT confirm when:
- Used for UI animations, jitter in retries, mock data, placeholder content.
- In a test fixture or seeded with a fixed value.

Severity:
- `critical` — session/auth token, password reset URL.
- `high` — OTP, invite code.
- `medium` — non-public random identifier.
- `low` — ambiguous.
