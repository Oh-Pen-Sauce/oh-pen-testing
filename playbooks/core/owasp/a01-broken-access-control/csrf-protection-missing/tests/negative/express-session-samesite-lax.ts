import express from "express";
import session from "express-session";
import { doubleCsrf } from "csrf-csrf";

const app = express();

// Safe near-miss: the session cookie is SameSite=lax and a token-based
// CSRF guard is wired in. This is the correct form of the same API.
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    },
  }),
);

const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? "dev",
});
app.use(doubleCsrfProtection);

app.post("/account/email", (req, res) => {
  updateEmail(req.session.userId, req.body.email);
  res.json({ ok: true });
});

function updateEmail(_userId: string, _email: string) {
  // ...
}

export default app;
