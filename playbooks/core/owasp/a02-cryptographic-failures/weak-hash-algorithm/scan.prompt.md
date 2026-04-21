## Playbook: weak-hash-algorithm (scan)

Confirm a weak hash when:
- Output is used for password hashing, session tokens, API keys, HMAC, or digital signatures.
- Output is compared against a security-sensitive value (e.g. password equality check).

Do NOT confirm when:
- Used purely for cache keys, ETag, file-integrity checks against non-adversarial sources, or deduplication.
- In a migration script explicitly verifying legacy data before rehashing.
- In a test fixture.

Severity:
- `critical` — password hashing with MD5/SHA-1.
- `high` — session/token/signing context.
- `medium` — HMAC without a specific attacker model.
- `low` — ambiguous context; flag for review.
