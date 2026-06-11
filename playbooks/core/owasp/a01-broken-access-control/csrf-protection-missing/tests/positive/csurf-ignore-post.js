const express = require("express");
const cookieParser = require("cookie-parser");
const csurf = require("csurf");

const app = express();
app.use(cookieParser());

// Vulnerable: POST is excused from CSRF protection, so the guard does
// nothing for the very requests that change server state.
const csrfProtection = csurf({
  cookie: true,
  ignoreMethods: ["GET", "HEAD", "OPTIONS", "POST"],
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
