import express from "express";
import type { Request, Response, NextFunction } from "express";

const router = express.Router();

// TypeScript handler with an explicit return-type annotation between the
// params and the arrow. Still a sensitive /admin route with no auth guard.
router.post(
  "/admin/promote",
  (req: Request, res: Response): Promise<void> => {
    return db.users.update({ id: req.body.userId }, { role: req.body.role });
  },
);

// Three typed params plus a void return annotation, also unguarded.
router.patch(
  "/admin/settings",
  (req: Request, res: Response, next: NextFunction): void => {
    saveSettings(req.body);
    res.json({ saved: true });
  },
);

export default router;
