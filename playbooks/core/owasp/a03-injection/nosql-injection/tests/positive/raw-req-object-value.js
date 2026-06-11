// Fixture: the bare req.body object is used as a field value inside the filter,
// not a scalar property. A client sending {"user": {"$ne": null}} smuggles a
// MongoDB operator into the sub-filter, so the lookup matches the first account.
const Session = require("../models/session");

async function lookupSession(req, res) {
  const session = await Session.findOne({ token: req.body });
  if (!session) return res.status(404).json({ error: "not found" });
  return res.json({ id: session._id });
}

module.exports = { lookupSession };
