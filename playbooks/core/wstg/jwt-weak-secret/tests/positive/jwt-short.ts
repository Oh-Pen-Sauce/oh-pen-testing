// Should flag: 8-char JWT secret literal.
import jwt from "jsonwebtoken";
export function sign(payload: object) {
  return jwt.sign(payload, "password");
}
