import express from "express";
import session from "express-session";

const app = express();

// Vulnerable: the session cookie is delivered on cross-site requests,
// so a malicious page can drive authenticated POSTs against this app.
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    },
  }),
);

app.post("/account/email", (req, res) => {
  // state-changing route with no CSRF token check
  updateEmail(req.session.userId, req.body.email);
  res.json({ ok: true });
});

function updateEmail(_userId: string, _email: string) {
  // ...
}

export default app;
