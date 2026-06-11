// Fixture: AES in ECB mode leaks plaintext patterns. Should flag.
import crypto from "node:crypto";

export function encryptEcb(key: Buffer, plaintext: string) {
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
}
