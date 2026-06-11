## Playbook: insecure-cipher-mode (remediate)

Move to an authenticated cipher with a modern mode:

1. Preferred: AES-256-GCM (node `crypto.createCipheriv("aes-256-gcm", key, iv)`, python `AESGCM`). It gives confidentiality and integrity in one step. Generate a fresh random 12-byte nonce per message and store the auth tag.
2. If a streaming AEAD is needed: ChaCha20-Poly1305.
3. If you genuinely cannot use AEAD: AES-256-CBC with a random IV per message, plus a separate HMAC-SHA-256 over the ciphertext (encrypt-then-MAC). Never ship CBC without a MAC.

Always replace, do not patch:
- ECB has no IV and no integrity. There is no safe configuration of it; switch the mode.
- DES and 3DES are retired by NIST. Re-key to AES, do not lengthen the DES key.
- RC4 is unfixable. Replace the cipher entirely.

If ciphertext from the old scheme must still be read, keep a decrypt-only legacy path with a comment and a removal date, and write all new data with the replacement.

`env_var_name`: none.
`env_example_addition`: none.
