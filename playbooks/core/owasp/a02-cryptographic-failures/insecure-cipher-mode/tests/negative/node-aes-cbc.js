// Fixture: AES-256-CBC with a random IV is acceptable here. Must NOT flag.
const crypto = require("node:crypto");

function encrypt(key, iv, plaintext) {
  const c = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
}

module.exports = { encrypt };
