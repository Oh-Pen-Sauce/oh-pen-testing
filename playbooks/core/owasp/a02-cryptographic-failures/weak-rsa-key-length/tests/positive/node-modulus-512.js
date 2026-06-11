// Fixture: async RSA generated at 512 bits. Should flag.
const crypto = require("node:crypto");

function makeKeyPair(cb) {
  crypto.generateKeyPair("rsa", { modulusLength: 512 }, cb);
}

module.exports = { makeKeyPair };
