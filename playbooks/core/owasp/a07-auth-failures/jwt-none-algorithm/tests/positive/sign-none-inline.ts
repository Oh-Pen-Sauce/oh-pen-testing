// Fixture: jwt.sign with inline algorithm 'none'. Should flag.
import jwt from "jsonwebtoken";

export function forgeToken(payload: object): string {
  return jwt.sign(payload, "", { algorithm: "none" });
}
