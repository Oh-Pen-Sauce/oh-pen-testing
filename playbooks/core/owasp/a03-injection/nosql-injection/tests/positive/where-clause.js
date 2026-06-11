// Fixture: $where clause built from user input runs attacker JavaScript in the DB.
const Account = require("../models/account");

async function search(req, res) {
  const results = await Account.find({
    active: true,
    $where: `this.balance > ${req.query.min}`,
  });
  res.json(results);
}

module.exports = { search };
