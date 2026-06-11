// Fixture: writing through the dotted __proto__ chain. Should flag.
function pollute(obj) {
  obj.__proto__.polluted = true;
  return obj;
}

module.exports = { pollute };
