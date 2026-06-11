// Fixture: the raw req.query object is handed straight to find() as the filter.
// Any $-prefixed key in the query string becomes a MongoDB operator.
import type { Request, Response } from "express";
import { db } from "./mongo";

export async function listProducts(req: Request, res: Response) {
  const products = await db.collection("products").find(req.query).toArray();
  res.json(products);
}

export async function removeWidget(req: Request, res: Response) {
  await db.collection("widgets").deleteMany(req.body);
  res.sendStatus(204);
}
