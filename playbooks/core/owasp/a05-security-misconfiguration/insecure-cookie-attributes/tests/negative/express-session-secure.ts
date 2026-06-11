import express from 'express';
import session from 'express-session';

const app = express();

// Hardened session config: HttpOnly, Secure, and a strict SameSite. The word
// "cookie" appears, but no attribute is set insecurely, so this must not fire.
app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 86_400_000,
    },
  }),
);

// secure is environment-gated rather than hardcoded to false.
function buildCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };
}

export { app, buildCookieOptions };
