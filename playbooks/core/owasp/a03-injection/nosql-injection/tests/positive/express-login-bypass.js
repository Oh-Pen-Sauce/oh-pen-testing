// Fixture: Express + Mongoose login where the raw request body is the filter.
// A client sending {"password": {"$ne": null}} bypasses the password check.
const express = require("express");
const User = require("../models/user");

const router = express.Router();

router.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email, password: req.body.password });
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  return res.json({ id: user._id });
});

module.exports = router;
