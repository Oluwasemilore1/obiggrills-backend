const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  customer: {
    name: String,
    address: String,
    phone: String,
  },
  items: [
    {
      id: Number,
      name: String,
      price: Number,
      quantity: Number,
    },
  ],
  total: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Order', OrderSchema);
