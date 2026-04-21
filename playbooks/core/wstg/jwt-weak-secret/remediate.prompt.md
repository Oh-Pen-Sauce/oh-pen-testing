## Playbook: jwt-weak-secret (remediate)

Require a >= 32-byte secret from env, no fallback:
```
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be >= 32 chars");
```
For RS256 / ES256, use a key pair (public/private) instead — prefer asymmetric for multi-service auth.
