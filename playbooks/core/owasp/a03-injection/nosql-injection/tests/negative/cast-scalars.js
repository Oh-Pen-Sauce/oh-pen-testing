// Fixture: the safe near-miss of the same API. Each value is cast to a string
// before the query, so an injected {"$ne": null} collapses to the string "[object Object]".
// Must NOT flag.
const express = require("express");
const User = require("../models/user");

const router = express.Router();

router.post("/login", async (req, res) => {
  const email = String(req.body.email);
  const password = String(req.body.password);
  const user = await User.findOne({ email, password });
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  return res.json({ id: user._id });
});

router.get("/users/:id", async (req, res) => {
  const user = await User.findById(String(req.params.id));
  res.json(user);
});

module.exports = router;
