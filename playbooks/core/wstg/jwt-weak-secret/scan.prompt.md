## Playbook: jwt-weak-secret (scan)

Confirm when a JWT secret is < 32 chars, hardcoded, or comes from `process.env.X ?? "default"` style fallback. A weak JWT secret makes every session forgeable.
