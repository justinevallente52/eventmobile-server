const mongoose = require('mongoose'); 
const { Schema } = mongoose;

const paymentSchema = new Schema({
  paymentID: {
    type: String,
    required: true,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString(),
  },
  bookingID: { type: String, required: true }, // Add this field
  qrcode: { type: String, required: false },
  venueName: { type: String, required: true },
  date: { type: Date, required: true },
  dayFormat: { type: String, enum: ['Day', 'Night', 'Whole Day', 'Overnight'], required: true },
  eventType: { type: String, required: true },
  selectedPackage: { type: String, required: true },
  price: { type: Number, required: true },
  userID: { type: String, required: true },
  username: { type: String, required: true },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Failed'],
    required: true,
  },
}, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
