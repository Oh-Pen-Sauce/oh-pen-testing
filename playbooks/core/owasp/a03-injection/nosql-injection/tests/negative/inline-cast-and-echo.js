// Fixture: safe near-misses for the raw-object rules. Each query value is wrapped
// in an inline scalar cast before it reaches the filter, and req.body is only ever
// echoed back in a response, never used as a query object. Must NOT flag.
const express = require("express");
const User = require("../models/user");

const router = express.Router();

router.post("/login", async (req, res) => {
  // Inline String() cast collapses any injected operator object to a string.
  const user = await User.findOne({ email: String(req.body.email), password: String(req.body.password) });
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  return res.json({ id: user._id });
});

router.post("/echo", (req, res) => {
  // req.body is echoed in the response payload, not used as a filter.
  res.json({ received: req.body, query: req.query });
});

module.exports = router;
