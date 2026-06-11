## Playbook: weak-rsa-key-length (scan)

Confirm a weak RSA key when:
- The match is the modulus length passed to an RSA key-generation call (`crypto.generateKeyPair`/`generateKeyPairSync` with `"rsa"`, or `rsa.generate_private_key`).
- The value is genuinely below 2048 bits (512, 768, 1024, 1536) and feeds key generation rather than an unrelated config field.

Do NOT confirm when:
- The number is a coincidental `modulusLength`/`key_size` on a non-RSA algorithm or an unrelated object (a buffer size, a port, a timeout).
- The key is explicitly a throwaway for a test fixture or a documented compatibility shim against a legacy peer that cannot accept 2048-bit keys.
- The literal is actually 2048 or larger; only sub-2048 moduli are in scope.

Severity:
- `high`: 512 or 768 bits, or any key used for TLS, signing, or long-lived secrets.
- `medium`: 1024 or 1536 bits in a general context.
- `low`: ambiguous context where the key's use cannot be determined; flag for review.
