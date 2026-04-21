// Fixture: SHA-256 for HMAC. Must NOT flag.
import crypto from "node:crypto";
export function sign(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
