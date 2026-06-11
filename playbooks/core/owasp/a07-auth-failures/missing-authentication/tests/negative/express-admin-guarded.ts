import express from "express";
import { requireAuth, isAuthenticated } from "./middleware/auth";

const router = express.Router();

// Same sensitive routes as the vulnerable fixture, but each one is
// guarded by an auth middleware placed before the handler.
router.post("/admin/promote", requireAuth, async (req, res) => {
  const { userId, role } = req.body;
  await db.users.update({ id: userId }, { role });
  res.json({ ok: true, userId, role });
});

router.delete("/admin/users/:id", isAuthenticated, async (req, res) => {
  await db.users.delete({ id: req.params.id });
  res.status(204).end();
});

export default router;
