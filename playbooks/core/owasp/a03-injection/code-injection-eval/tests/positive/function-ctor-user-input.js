function build(userCode) {
  // new Function with a non-literal body is code injection.
  return new Function(userCode);
}

module.exports = { build };
