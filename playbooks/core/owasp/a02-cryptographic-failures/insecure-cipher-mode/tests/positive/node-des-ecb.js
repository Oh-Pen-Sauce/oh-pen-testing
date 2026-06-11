// Fixture: DES (and ECB mode) is broken. Should flag.
const crypto = require("node:crypto");

function encryptToken(key, iv, token) {
  const c = crypto.createCipheriv("des-ecb", key, iv);
  return Buffer.concat([c.update(token, "utf8"), c.final()]);
}

module.exports = { encryptToken };
