// Fixture: Express DELETE handler with no auth anywhere. Should flag.
import express from "express";
const app = express();

app.delete("/api/accounts/:id", async (req, res) => {
  const id = req.params.id;
  await db.accounts.delete(id);
  res.json({ deleted: true });
});
