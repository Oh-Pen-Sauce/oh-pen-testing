## Playbook: insecure-password-storage (remediate)

Never store plaintext. Hash with a password-hashing function (argon2 preferred, bcrypt fallback).

- Node + argon2:
  ```
  import argon2 from "argon2";
  const hash = await argon2.hash(password);
  // store `hash` in user.passwordHash
  // later:
  const ok = await argon2.verify(user.passwordHash, attempt);
  ```
- Node + bcrypt:
  ```
  import bcrypt from "bcrypt";
  const hash = await bcrypt.hash(password, 12);
  const ok = await bcrypt.compare(attempt, user.passwordHash);
  ```
- Python + argon2-cffi: `argon2.PasswordHasher().hash(pw)`.

Rename the column from `password` to `passwordHash` / `password_hash` — make the plaintext mistake harder to reintroduce later.

`env_var_name`: none.
