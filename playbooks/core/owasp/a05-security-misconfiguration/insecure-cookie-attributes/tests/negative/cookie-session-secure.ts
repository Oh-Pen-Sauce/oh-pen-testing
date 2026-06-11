import express from 'express';
import cookieSession from 'cookie-session';

const app = express();

// Hardened cookie-session: secure and httpOnly are both on at the top level.
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_KEY as string],
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 86_400_000,
  }),
);

// An unrelated, non-cookie options object that happens to set httpOnly false on
// a different concept. It lives outside the cookieSession() call and must not be
// dragged into a match by the session rule.
const proxyDefaults = {
  followRedirects: true,
  httpOnly: false,
};

export { app, proxyDefaults };
