// Fixture: RSA generated at 1024 bits. Should flag.
import crypto from "node:crypto";

export function makeKeyPair() {
  return crypto.generateKeyPairSync("rsa", { modulusLength: 1024 });
}
