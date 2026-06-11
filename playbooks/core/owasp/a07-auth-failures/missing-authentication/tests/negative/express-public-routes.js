const express = require("express");
const passport = require("passport");
const app = express();

// Ordinary public routes. No sensitive path prefix, so no auth needed.
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/products", async (req, res) => {
  const products = await db.products.findAll();
  res.json(products);
});

app.post("/contact", (req, res) => {
  sendContactEmail(req.body);
  res.json({ received: true });
});

// Sensitive admin route, but guarded by passport.authenticate.
app.post(
  "/admin/settings",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    saveSettings(req.body);
    res.json({ saved: true });
  }
);

module.exports = app;
