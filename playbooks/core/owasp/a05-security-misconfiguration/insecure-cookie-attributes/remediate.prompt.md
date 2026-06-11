## Playbook: owasp/a05-security-misconfiguration/insecure-cookie-attributes (remediate)

Set every session or auth cookie with all three protections: HttpOnly stops JavaScript from reading it, Secure keeps it off plain HTTP, and SameSite limits cross-site sending.

```js
res.cookie('sid', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 1000 * 60 * 60,
});
```

For express-session or cookie-session, mirror the same in the cookie config:

```js
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
}));
```

If you genuinely need SameSite none for a cross-site embed, you must pair it with secure true; never ship SameSite none over HTTP. When a Secure cookie has to work in local development over HTTP, gate the flag on the environment (secure: process.env.NODE_ENV === 'production') rather than disabling it outright.
