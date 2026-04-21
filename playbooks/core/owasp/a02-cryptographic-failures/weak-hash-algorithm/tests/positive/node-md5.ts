// Fixture: MD5 on passwords. Should flag.
import crypto from "node:crypto";
export function hashPassword(pw: string) {
  return crypto.createHash("md5").update(pw).digest("hex");
}
