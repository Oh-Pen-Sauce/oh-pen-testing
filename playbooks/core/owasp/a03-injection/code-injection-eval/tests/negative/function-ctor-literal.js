// All-literal Function constructor: not derived from input.
const add = new Function("a", "b", "return a + b");

module.exports = { add };
