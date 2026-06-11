import express from "express";
import type { Request, Response } from "express";

const router = express.Router();

// Deletes any user account by id with no authentication guard at all.
// /api/users/:id is a privileged, destructive operation: anyone who can
// reach the URL can wipe accounts.
router.delete(
  "/api/users/:id",
  async (req: Request, res: Response): Promise<void> => {
    await db.users.delete({ id: req.params.id });
    res.status(204).end();
  },
);

// Overwrites a user record (role, email, etc.) via a bare handler with
// no auth middleware in front of it.
router.put("/api/users/:id", updateUser);

export default router;
