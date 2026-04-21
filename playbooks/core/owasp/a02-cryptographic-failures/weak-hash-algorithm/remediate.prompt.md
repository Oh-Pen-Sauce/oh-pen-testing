## Playbook: weak-hash-algorithm (remediate)

Replace with a modern algorithm appropriate to the use:

- Password hashing → `argon2` (node `argon2` or python `argon2-cffi`) or `bcrypt` (fallback). Never SHA variants.
- Signatures / HMAC → `sha256` minimum, `sha512` or `blake2b` preferred.
- Token generation → switch to `crypto.randomBytes` or `secrets.token_urlsafe`; hashing isn't the right primitive.
- File integrity against adversaries → `sha256` minimum.

Do not just upgrade the hash name without reading the code — if the purpose was password hashing, the fix is an entirely different API.

`env_var_name`: none.
`env_example_addition`: none.
