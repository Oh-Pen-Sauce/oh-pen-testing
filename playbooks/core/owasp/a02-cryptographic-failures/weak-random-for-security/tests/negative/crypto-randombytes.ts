// Fixture: crypto.randomBytes for tokens. Must NOT flag.
import crypto from "node:crypto";

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
