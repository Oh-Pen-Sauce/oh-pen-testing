import express from "express";

const app = express();

// Vulnerable: the session cookie is written by hand via a Set-Cookie
// header with SameSite=None, so it rides along on cross-site requests.
// The object-literal sameSite rules never see this attribute-string form.
app.post("/login", (req, res) => {
  const sid = createSession(req.body.username);
  res.setHeader(
    "Set-Cookie",
    `sid=${sid}; HttpOnly; Secure; Path=/; SameSite=None`,
  );
  res.json({ ok: true });
});

app.post("/account/email", (req, res) => {
  // state-changing route, no CSRF token check
  updateEmail(req.cookies?.sid, req.body.email);
  res.json({ ok: true });
});

function createSession(_username: string) {
  return "tok";
}

function updateEmail(_sid: string, _email: string) {
  // ...
}

export default app;
