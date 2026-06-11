## Playbook: owasp/a01-broken-access-control/csrf-protection-missing (remediate)

Keep the session cookie SameSite-restricted and add a token-based CSRF guard on state-changing routes. Set `sameSite: 'lax'` (or `'strict'` for the most sensitive apps) and never `'none'`/`false` on a session cookie. Pair it with a CSRF middleware so forged cross-site POSTs are rejected even on older browsers.

```
import session from 'express-session';
import { doubleCsrf } from 'csrf-csrf';

app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
}));

const { doubleCsrfProtection } = doubleCsrf({ getSecret: () => process.env.CSRF_SECRET });
app.use(doubleCsrfProtection); // do not add POST/PUT/PATCH/DELETE to any ignore list
```

If a cookie genuinely must be delivered cross-site (an embedded third-party widget), scope that to its own non-session cookie and keep the auth/session cookie SameSite-restricted. Do not excuse state-changing verbs via `ignoreMethods`; only GET, HEAD, and OPTIONS are safe to skip.
