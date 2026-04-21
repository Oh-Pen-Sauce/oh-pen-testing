## Playbook: weak-password-policy (scan)

Confirm when a password validation rule allows fewer than 8 characters.

Do NOT confirm when:
- The rule is for a non-password field (username, display name, verification code).
- The constraint is clearly a minimum visible UX length, not a security min.

Severity:
- `high` — production signup form with minLength < 6.
- `medium` — minLength 6-7.
- `low` — anywhere else.

Reference: NIST SP 800-63B requires memorised secrets to be at least 8 chars.
