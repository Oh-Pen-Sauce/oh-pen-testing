import express from "express";
import type { Request, Response } from "express";
import { requireAuth, isAuthenticated } from "./middleware/auth";

const router = express.Router();

// Read-only GET on /api/users is not a destructive operation, so even
// without a dedicated guard here it must not be flagged by the
// destructive-user-route rules (they only target delete/put/patch).
router.get("/api/users/:id", async (req: Request, res: Response) => {
  const user = await db.users.findById(req.params.id);
  res.json(user);
});

// Destructive operations on the same resource, but each one has an auth
// middleware placed before the handler. These must stay clean.
router.delete(
  "/api/users/:id",
  isAuthenticated,
  async (req: Request, res: Response): Promise<void> => {
    await db.users.delete({ id: req.params.id });
    res.status(204).end();
  },
);

router.put("/api/users/:id", requireAuth, updateUser);

export default router;
