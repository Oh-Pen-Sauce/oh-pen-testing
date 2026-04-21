## Playbook: insecure-password-storage (scan)

Confirm when the code stores or compares passwords without hashing.

Do NOT confirm when:
- The column named `password` is clearly something else (e.g. `api_key`, `secret` used for service-to-service — still bad but different playbook).
- Comparison is against a previously-hashed `user.passwordHash` field.
- A hash function (bcrypt, argon2, scrypt) is visible in the context.

Severity:
- `critical` — plaintext password ever persisted or compared.
