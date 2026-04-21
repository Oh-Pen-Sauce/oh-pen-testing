// Must NOT flag: env-sourced with length check.
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be strong");
export function sign(payload: object) {
  return jwt.sign(payload, JWT_SECRET);
}
