import express from 'express';
import cookieSession from 'cookie-session';

const app = express();

// cookie-session takes the cookie attributes at the top level of the options
// object, not under a nested cookie key. Here secure and httpOnly are both
// forced off, so the session rides over plain HTTP and is readable by script.
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_KEY as string],
    secure: false,
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 86_400_000,
  }),
);

export default app;
