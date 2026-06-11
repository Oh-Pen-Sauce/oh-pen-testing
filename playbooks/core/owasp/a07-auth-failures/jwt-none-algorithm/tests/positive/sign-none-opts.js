// Fixture: jwt.sign with algorithm "none" via a separate options object. Should flag.
const jwt = require("jsonwebtoken");

function forge(data) {
  const opts = { algorithm: "none" };
  return jwt.sign(data, null, opts);
}

module.exports = { forge };
