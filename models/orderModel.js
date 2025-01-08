const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderID: { type: String, required: true, unique: true },
  userID: { type: String, required: true },
  username: { type: String, required: true },
  venueName: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  eventType: { type: String, required: true },
  selectedPackage: { type: String, required: true },
  price: { type: Number, required: true },
  paymentStatus: { type: String, required: true, enum: ['CREATED', 'PAID', 'CANCELLED'], default: 'PAID' },
  createdAt: { type: Date, default: Date.now },
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
