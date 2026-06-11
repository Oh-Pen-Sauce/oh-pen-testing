// Fixture: input is validated to a scalar before the query, and a separate
// query uses a literal filter object with no request data. Must NOT flag.
import type { Request, Response } from "express";
import { z } from "zod";
import { db } from "./mongo";

const emailSchema = z.string().email();

export async function findByEmail(req: Request, res: Response) {
  const validatedEmail = emailSchema.parse(req.body.email);
  const user = await db.collection("users").findOne({ email: validatedEmail });
  res.json(user);
}

export async function activeProducts(_req: Request, res: Response) {
  // Literal filter, no user input anywhere in the object.
  const products = await db.collection("products").find({ status: "active" }).toArray();
  res.json(products);
}
