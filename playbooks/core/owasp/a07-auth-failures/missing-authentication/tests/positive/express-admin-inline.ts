import express from "express";

const router = express.Router();

// Admin dashboard: promotes a user to superadmin. No auth guard at all.
router.post("/admin/promote", async (req, res) => {
  const { userId, role } = req.body;
  await db.users.update({ id: userId }, { role });
  res.json({ ok: true, userId, role });
});

// Deletes any user account by id. Anyone who knows the route can call it.
router.delete("/admin/users/:id", async (req, res) => {
  await db.users.delete({ id: req.params.id });
  res.status(204).end();
});

export default router;
