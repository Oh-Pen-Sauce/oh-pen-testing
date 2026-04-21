## Playbook: no-rate-limit-on-auth (remediate)

Add a rate-limit middleware. Use the library the project already has (grep for `rate-limit`, `slow-down`, `limiter`). If none exists, recommend:

- Node/Express: `express-rate-limit`:
  ```
  import rateLimit from "express-rate-limit";
  const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, standardHeaders: true });
  app.post("/login", authLimiter, ...);
  ```
- Python/FastAPI: `slowapi`:
  ```
  from slowapi import Limiter
  limiter = Limiter(key_func=lambda req: req.client.host)
  @router.post("/login")
  @limiter.limit("5/minute")
  async def login(...):
  ```

Defaults: 5 attempts / 15 minutes / IP for login; 3 / hour for password reset.

Don't scaffold a whole auth system — if a limiter lib isn't installed, set `auto_fixable: false` and recommend adding the dependency.
