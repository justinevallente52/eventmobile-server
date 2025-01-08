const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingID: { type: String, unique: true },
  venueID: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  userID: { type: String, required: true },
  userName: { type: String, required: true },
  bookingDate: { type: Date, required: true },
  dayFormat: { type: String, enum: ['Day', 'Night', 'Whole Day', 'Overnight'], required: true }, // Updated field
  eventType: { type: String, required: true },
  venueName: { type: String, required: true },
  venuePrice: { type: Number, required: true },
  package: { type: String, required: true },
  totalPrice: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Not Paid', 'Paid'], default: 'Not Paid' },
  createdAt: { type: Date, default: Date.now },
});

// Check if the model is already defined
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;
