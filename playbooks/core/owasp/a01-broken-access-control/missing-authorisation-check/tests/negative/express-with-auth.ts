// Fixture: Express DELETE with requireAuth middleware AND req.user check. Must NOT flag.
import express from "express";
import { requireAuth } from "./auth";
const app = express();

app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
  if (!req.user || req.user.id !== Number(req.params.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  await db.accounts.delete(req.params.id);
  res.json({ deleted: true });
});
