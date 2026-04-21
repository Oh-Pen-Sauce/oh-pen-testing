// Fixture: rejectUnauthorized: false. Should flag.
const https = require("https");
module.exports = new https.Agent({ rejectUnauthorized: false });
