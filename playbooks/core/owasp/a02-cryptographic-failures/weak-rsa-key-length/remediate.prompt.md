## Playbook: weak-rsa-key-length (remediate)

Raise the modulus to at least 2048 bits. 3072 bits is the better default for keys that must stay valid past 2030.

- Node: set `modulusLength: 2048` (or `3072`) in the `generateKeyPair`/`generateKeyPairSync` options.
- Python `cryptography`: set `key_size=2048` (or `3072`) in `rsa.generate_private_key`.

If the key is short-lived and performance is the reason it was small, prefer an elliptic-curve key instead: it is faster and stronger at a smaller size.

- Node: `crypto.generateKeyPairSync("ec", { namedCurve: "P-256" })`.
- Python: `ec.generate_private_key(ec.SECP256R1())`.

Rotate any key already generated at the weak length; raising the length in code does not retire the weak key that is already in use.

`env_var_name`: none.
`env_example_addition`: none.
