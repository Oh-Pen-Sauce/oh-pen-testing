// Fixture: contains a PEM private key header. Scanner must flag.
// Body is truncated to keep the fixture small.

const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA... (truncated) ...
-----END RSA PRIVATE KEY-----`;

module.exports = { PRIVATE_KEY };
