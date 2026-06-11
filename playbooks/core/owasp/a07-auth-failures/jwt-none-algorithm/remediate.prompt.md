## Playbook: jwt-none-algorithm (remediate)

Preferred fixes in order:
1. Pick a real algorithm. For a shared secret use HMAC: `{ algorithm: "HS256" }`. For a key pair use RSA or ECDSA: `{ algorithm: "RS256" }` or `{ algorithm: "ES256" }`.
2. On verification, pin the allowed set and never include `none`:
   ```
   jwt.verify(token, key, { algorithms: ["RS256"] });
   ```
   Python (PyJWT): `jwt.decode(token, key, algorithms=["RS256"])`. PyJWT rejects `none` unless you opt in, so do not pass `none` back in.
3. Make sure a signing secret or key is actually supplied. A `none` token is often paired with an empty or null key (`jwt.sign(payload, "", ...)`); give it a real secret loaded from the environment.
4. If a downstream system genuinely needs unsigned tokens, do not use JWT for that path; use a separate, clearly-named format so it cannot be confused with a verified token.

`env_var_name`: the signing secret or private key should come from an environment variable, for example `JWT_SECRET` or `JWT_PRIVATE_KEY`, never a hard-coded literal.
