## Playbook: insecure-cipher-mode (scan)

Confirm a weak cipher or mode when:
- AES (or any block cipher) is used in ECB mode to encrypt application data.
- DES, 3DES, RC4, or RC2 is used to encrypt or decrypt anything.
- The cipher feeds a `createCipheriv` / `createDecipheriv`, a `Cipher(...)` construction, or an equivalent encrypt/decrypt call.

Do NOT confirm when:
- The string is interoperating with a fixed external protocol that mandates the algorithm, and the match is a comment explaining why it cannot change yet.
- It appears in a test fixture, a vector file, or a decrypt-only path that exists solely to migrate legacy data off the weak cipher.
- The token is unrelated to cryptography (a column name, an enum label) and is not passed to a cipher constructor.

Severity:
- `high`: ECB mode, DES, or RC4 protecting confidential data.
- `high`: 3DES on a 64-bit block protecting long-lived or high-volume data (Sweet32).
- `medium`: legacy decrypt-only migration path with a clear sunset.
