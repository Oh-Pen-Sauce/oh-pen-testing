// Fixture: a mutating Mongoose call takes the raw request body as its filter.
// findOneAndReplace and replaceOne both treat the first argument as the query,
// so {"_id": {"$ne": null}} replaces an arbitrary document.
import type { Request, Response } from "express";
import { Account } from "./models";

export async function overwriteAccount(req: Request, res: Response) {
  const replaced = await Account.findOneAndReplace(req.body, { archived: true });
  res.json(replaced);
}

export async function swapRecord(req: Request, res: Response) {
  await Account.replaceOne(req.query, { archived: true });
  res.sendStatus(204);
}
