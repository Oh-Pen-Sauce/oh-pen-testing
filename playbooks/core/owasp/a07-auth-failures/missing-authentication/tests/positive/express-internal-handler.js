const express = require("express");
const app = express();

function flushCache(req, res) {
  cache.clear();
  res.json({ flushed: true });
}

// Internal cache-flush endpoint, guarded only by a comment.
// TODO: add auth before shipping to prod
app.put("/internal/cache/flush", flushCache);

// Debug route that dumps the full runtime config including secrets.
app.get("/debug/config", function (req, res) {
  res.json(process.env);
});

module.exports = app;
