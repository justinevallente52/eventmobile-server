const mongoose = require('mongoose');

// Venue schema
const venueSchema = new mongoose.Schema({
  venueID: { type: String, unique: true },
  venuePicture: String,
  venueName: String,
  venueLocation: String,
  venueDetails: String,
  venuePrice: Number,
  eventTypes: [String], // Array of event types such as 'Birthday', 'Pool', etc.
});

const Venue = mongoose.model('Venue', venueSchema);

module.exports = Venue; // Export the Venue model for use in other files
