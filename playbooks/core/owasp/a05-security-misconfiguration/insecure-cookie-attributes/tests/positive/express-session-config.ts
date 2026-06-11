import express from 'express';
import session from 'express-session';

const app = express();

// secure is forced off for every environment, so the session cookie travels
// over plain HTTP and SameSite none lets it ride cross-site requests.
app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'none',
      maxAge: 86_400_000,
    },
  }),
);

export default app;
