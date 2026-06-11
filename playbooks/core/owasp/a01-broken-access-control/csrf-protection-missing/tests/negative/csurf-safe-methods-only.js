const express = require("express");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");

const app = express();
app.use(cookieParser());

// Safe: only the truly safe verbs are excused. State-changing requests
// (POST/PUT/PATCH/DELETE) all flow through the CSRF check.
const csrfProtection = csurf({
  cookie: { httpOnly: true, sameSite: "strict" },
  ignoreMethods: ["GET", "HEAD", "OPTIONS"],
});

app.use(csrfProtection);

app.post("/transfer", (req, res) => {
  transferFunds(req.session.userId, req.body.to, req.body.amount);
  res.json({ ok: true });
});

function transferFunds() {
  // ...
}

module.exports = app;
