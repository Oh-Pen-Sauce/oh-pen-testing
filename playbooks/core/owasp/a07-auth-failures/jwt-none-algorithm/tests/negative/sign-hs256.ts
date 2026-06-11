// Fixture: jwt.sign with a real HMAC algorithm. Must NOT flag.
import jwt from "jsonwebtoken";

export function issueToken(payload: object, secret: string): string {
  return jwt.sign(payload, secret, { algorithm: "HS256" });
}
