// Fixture: RSA generated at 2048 bits. Must NOT flag.
import crypto from "node:crypto";

export function makeKeyPair() {
  return crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
}
