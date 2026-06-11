// Fixture: id is validated and converted to an ObjectId, and a sanitiser strips
// $-prefixed keys upstream. The query never receives a raw request object. Must NOT flag.
const mongoose = require("mongoose");
const Order = require("../models/order");

async function getOrder(req, res) {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "bad id" });
  }
  const order = await Order.findById(new mongoose.Types.ObjectId(id));
  return res.json(order);
}

async function searchOrders(req, res) {
  const status = String(req.query.status);
  const orders = await Order.find({ status });
  return res.json(orders);
}

module.exports = { getOrder, searchOrders };
