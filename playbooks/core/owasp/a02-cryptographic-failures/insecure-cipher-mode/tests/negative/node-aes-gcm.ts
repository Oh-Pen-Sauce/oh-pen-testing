// Fixture: AES-256-GCM is an authenticated, modern choice. Must NOT flag.
import crypto from "node:crypto";

export function encryptGcm(key: Buffer, iv: Buffer, plaintext: string) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ct, tag: cipher.getAuthTag() };
}
