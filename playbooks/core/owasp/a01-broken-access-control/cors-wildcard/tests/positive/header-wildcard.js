// Fixture: literal Access-Control-Allow-Origin: * in response. Should flag.
module.exports = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
};
