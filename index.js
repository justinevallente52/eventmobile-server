// Existing imports
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const dotenv = require('dotenv');
const QRCode = require('qrcode');
const paypal = require('@paypal/checkout-server-sdk');
const Venue = require('./models/venueModel');
const Booking = require('./models/bookingModel');

// Initialize dotenv to access environment variables
dotenv.config();

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
const client = new paypal.core.PayPalHttpClient(environment);

// Create an Express app
const app = express();

// Middleware
app.use(express.json()); // For parsing JSON request bodies
app.use(cors()); // Enable Cross-Origin Resource Sharing

// Port where the server will run
const PORT = process.env.PORT || 3001;

// MongoDB connection using Mongoose
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch((error) => console.error('MongoDB connection error:', error));


app.get("/api/venues/birthday", async (req, res) => {
    try {
      const venues = await Venue.find({ eventTypes: "Birthday" });
      res.status(200).json({ success: true, venues });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Failed to fetch birthday venues" });
    }
  });
  

app.get("/api/venues/pool", async (req, res) => {
    try {
        const venues = await Venue.find({ eventTypes: "Pool" });
        res.status(200).json({ success: true, venues });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch pool venues" });
    }
});

app.get("/api/venues/party", async (req, res) => {
    try {
      const venues = await Venue.find({ eventTypes: "Party" });
      res.status(200).json({ success: true, venues });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Failed to fetch party venues" });
    }
  });

app.get("/api/venues/wedding", async (req, res) => {
    try {
        const venues = await Venue.find({ eventTypes: "Wedding" });
        res.status(200).json({ success: true, venues });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch wedding venues" });
    }
});

// POST route to create a new booking
app.post('/api/bookings', async (req, res) => {
  const {
    venueID,
    eventType,
    userID,
    userName,
    bookingDate,
    dayFormat, // Updated field
    venueName,
    venuePrice,
    package,
    totalPrice,
  } = req.body;

  try {
    // Check if the venue is already booked for the selected date and day format
    const existingBooking = await Booking.findOne({
      venueID,
      bookingDate: { $eq: new Date(bookingDate).toISOString() },
    });

    if (dayFormat === 'Whole Day') {
      // If booking is "Whole Day", no other booking should exist for that date
      if (existingBooking) {
        return res.json({
          success: false,
          message: 'The venue is already booked for the whole day. Please choose another day or time format.',
        });
      }
    } else if (dayFormat === 'Day') {
      // If booking is "Day", ensure it's not already booked for "Whole Day" or "Day"
      if (existingBooking && (existingBooking.dayFormat === 'Whole Day' || existingBooking.dayFormat === 'Day')) {
        return res.json({
          success: false,
          message: 'The venue is already booked for the whole day or day format. Please choose another time format or date.',
        });
      }
    } else if (dayFormat === 'Night') {
      // If booking is "Night", ensure it's not already booked for "Whole Day" or "Night"
      if (existingBooking && (existingBooking.dayFormat === 'Whole Day' || existingBooking.dayFormat === 'Night')) {
        return res.json({
          success: false,
          message: 'The venue is already booked for the whole day or night format. Please choose another time format or date.',
        });
      }
    } else if (dayFormat === 'Overnight') {
      // If booking is "Overnight", ensure it's not already booked for "Whole Day" or "Overnight"
      if (existingBooking && (existingBooking.dayFormat === 'Whole Day' || existingBooking.dayFormat === 'Overnight')) {
        return res.json({
          success: false,
          message: 'The venue is already booked for the whole day or overnight format. Please choose another time format or date.',
        });
      }
    }

    // Fetch and increment the counter for bookingID
    const counter = await Counter.findOneAndUpdate(
      {},
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );

    const bookingID = String(counter.sequenceValue).padStart(2, '0'); // Format the ID as "01", "02", etc.

    // Create a new booking with the bookingID and other details
    const newBooking = new Booking({
      bookingID,
      venueID,
      eventType,
      userID,
      userName,
      bookingDate,
      dayFormat, // Updated field
      venueName,
      venuePrice,
      package, // Save selected package
      totalPrice, // Save calculated total price
    });

    await newBooking.save();
    res.json({ success: true, message: 'Booking successful', bookingID });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error creating booking' });
  }
});




 // Route to fetch user bookings
app.get('/api/bookings/user', async (req, res) => {
    const { userID } = req.query;

    try {
        // Populate venueName, eventType, paymentStatus, totalPrice, and other relevant fields
        const bookings = await Booking.find({ userID })
            .select('venueName bookingDate bookingTime eventType paymentStatus totalPrice'); // Select additional fields

        if (!bookings.length) {
            return res.status(404).json({ error: 'No bookings found for this user' });
        }

        res.status(200).json({
            bookings,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Define a User schema for signup and login
const userSchema = new mongoose.Schema({
    userID: { type: String, required: true, unique: true }, // Unique userID starting with 01
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true },
    qrCode: { type: String }, // Field for storing QR code data (as a string)
    profilePic: { type: String }, // Field for storing the URL of the profile picture
});

const User = mongoose.model('User', userSchema);


// POST route to sign up a new user
app.post('/api/signup', async (req, res) => {
    const { email, username, phoneNumber, password } = req.body;

    try {
        // Check if the email or username is already taken
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(409).json({ error: 'Email or Username is already registered' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Fetch the current counter value and increment it
        const counter = await Counter.findOneAndUpdate(
            {},
            { $inc: { sequenceValue: 1 } },
            { new: true, upsert: true }
        );

        const userID = String(counter.sequenceValue + 1).padStart(2, '0'); // Generate userID
        const qrCodeData = `UserID: ${userID}, Email: ${email}, Username: ${username}`; // QR code data

        // Generate QR code as a data URL
        const qrCode = await QRCode.toDataURL(qrCodeData);

        // Create a new user
        const newUser = new User({
            userID,
            email,
            username,
            phoneNumber,
            password: hashedPassword,
            qrCode, // Save the QR code as a data URL
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully!', userID: newUser.userID });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Get token from Authorization header
    if (!token) {
      return res.status(403).json({ error: 'Access denied' });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
      req.user = decoded; // Add decoded user info to the request object
      next(); // Proceed to the next middleware/route handler
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
  
  // POST route to log in an existing user
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Compare the provided password with the hashed password in the database
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
  
      // Generate JWT token
      const token = jwt.sign(
        { userID: user.userID, username: user.username, email: user.email },
        process.env.JWT_SECRET, // JWT secret from the environment
        { expiresIn: '1h' } // Token expiration time
      );
  
      // Send user data and token back upon successful login
      res.status(200).json({
        message: 'Login successful',
        token, // Send the token back to the client
        user: {
          userID: user.userID,
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profilePic: user.profilePic,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to log in' });
    }
  });

  // Define a Counter schema for managing user IDs
const counterSchema = new mongoose.Schema({
  sequenceValue: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

const orderSchema = new mongoose.Schema({
  orderID: { type: String, required: true, unique: true },
  status: { type: String, default: 'CREATED' }, // Could be CREATED, CAPTURED, etc.
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
})

const Order = mongoose.model('Order', orderSchema);

// Function to initialize the counter
const initializeCounter = async () => {
  await Counter.create({ sequenceValue: 0 });
};

// Call this function once to set up the initial counter if needed
initializeCounter().catch(console.error);

  
  // Example of protected route
  app.get('/api/user/profile', authenticateJWT, async (req, res) => {
    const { userID } = req.user; // Use user info from the decoded JWT token
  
    try {
      const user = await User.findOne({ userID });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Return user info including QR code if available
      res.status(200).json({
        userID: user.userID,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePic: user.profilePic,
        qrCode: user.qrCode,  // Return the QR code here
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

// DELETE route to cancel a booking by bookingID
app.delete('/api/bookings/:bookingID', async (req, res) => {
  const { bookingID } = req.params;

  try {
    const booking = await Booking.findOneAndDelete({ bookingID });
    if (booking) {
      res.json({ success: true, message: 'Booking cancelled successfully.' });
    } else {
      res.json({ success: false, message: 'Booking not found.' });
    }
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Error canceling booking.' });
  }
});


// PUT route to update user profile
app.put('/api/user/update', async (req, res) => {
    const { currentEmail, newEmail, username, phoneNumber, profilePic } = req.body;

    if (!currentEmail) {
        return res.status(400).json({ error: 'Current email is required to find the user.' });
    }

    try {
        // Find the user by current email
        const user = await User.findOne({ email: currentEmail });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Ensure the new username is not taken by another user (if provided and different)
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(409).json({ error: 'Username is already taken' });
            }
            user.username = username; // Only update username if it passed the checks
        }

        // Ensure the new email is not taken by another user (if provided and different)
        if (newEmail && newEmail !== user.email) {
            const existingEmailUser = await User.findOne({ email: newEmail });
            if (existingEmailUser) {
                return res.status(409).json({ error: 'Email is already registered' });
            }
            user.email = newEmail; // Update email only if it passed the checks
        }

        // Update phone number if provided
        if (phoneNumber) user.phoneNumber = phoneNumber;
        // Update profile picture if provided
        if (profilePic) user.profilePic = profilePic;

        // Save the updated user document
        const updatedUser = await user.save();

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                userID: updatedUser.userID,
                email: updatedUser.email,
                username: updatedUser.username,
                phoneNumber: updatedUser.phoneNumber,
                profilePic: updatedUser.profilePic,
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile: ' + error.message });
    }
});

app.post('/api/create-order', async (req, res) => {
    const { price } = req.body;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'PHP', value: price.toString() } }],
        application_context: {
            return_url: 'https://eventmobile-server.onrender.com/success',
            cancel_url: 'https://eventmobile-server.onrender.com/cancel',
        },
    });

    try {
        const order = await client.execute(request);
        const approvalLink = order.result.links.find(link => link.rel === 'approve');
        if (!approvalLink) throw new Error('Approval link not found.');
        await Order.create({ orderID: order.result.id, status: 'CREATED', amount: price });
        res.json({ approvalUrl: approvalLink.href });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/execute-payment', async (req, res) => {
    const { orderID, payerID } = req.body;

    try {
        // Fetch the order details from PayPal
        const request = new paypal.orders.OrdersGetRequest(orderID);
        const orderDetails = await client.execute(request);

        // Check if the order is already captured
        if (orderDetails.result.status === 'COMPLETED') {
            return res.status(200).json({ message: 'Order already captured.' });
        }

        // Capture the order if not already completed
        const captureRequest = new paypal.orders.OrdersCaptureRequest(orderID);
        captureRequest.requestBody({});
        const captureResponse = await client.execute(captureRequest);

        if (captureResponse.result.status === 'COMPLETED') {
            return res.status(200).json({ message: 'Payment captured successfully.' });
        } else {
            return res.status(400).json({ error: 'Failed to capture payment.' });
        }
    } catch (error) {
        console.error('Error capturing PayPal order:', error);
        res.status(500).json({ error: 'An error occurred while capturing the payment.' });
    }
});


app.get('/success', (req, res) => {
    res.send('Payment successful. You can close this window.');
});

app.get('/cancel', (req, res) => {
    res.send('Payment was cancelled. You can close this window.');
});

const Payment = require('./models/paymentModel');

app.post('/api/payment/success', async (req, res) => {
  const {
    venueName, date, time, eventType, selectedPackage, price, userID, username, bookingID, dayFormat,
  } = req.body;

  try {
    const paymentID = new mongoose.Types.ObjectId().toString(); // Generate unique paymentID

    // Generate QR code (can encode payment details for now)
const qrCodeData = `PaymentID: ${paymentID}, Venue: ${venueName}, Date: ${date}, Day: ${dayFormat}`;
const qrCode = await QRCode.toDataURL(qrCodeData);


    // Create a new payment record
    const payment = new Payment({
      paymentID,
      qrcode: qrCode, // Store the generated QR code
      bookingID,
      venueName,
      date,
      dayFormat,
      eventType,
      selectedPackage,
      price,
      userID,
      username,
      paymentStatus: 'Paid', // Mark as Paid
    });

    await payment.save(); // Save to the database
    res.status(201).json({ success: true, message: 'Payment stored successfully.', paymentID });
  } catch (error) {
    console.error('Error storing payment:', error);
    res.status(500).json({ success: false, error: 'Failed to store payment details.' });
  }
});

// Route to fetch payments by user ID
app.get('/api/payments/user', async (req, res) => {
  const { userID } = req.query;
  try {
    const payments = await Payment.find({ userID }).select('bookingID venueName date time eventType selectedPackage price paymentStatus qrcode dayFormat');
    if (!payments.length) {
      return res.status(404).json({ error: 'No payments found for this user' });
    }
    res.status(200).json({ payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});



const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Store OTP in-memory or use a database model
let otpStorage = {}; // Example: { email: { otp, expiryTime } }

// Endpoint to send OTP
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Store OTP and set expiry time (10 minutes from now)
    otpStorage[email] = {
        otp,
        expiryTime: Date.now() + 10 * 60 * 1000, // OTP expires in 10 minutes
    };

    // Send OTP to user's email (Using nodemailer)
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Use your email provider
        auth: {
      user: 'eventsplacemanagement@gmail.com',
      pass: 'lyej edep yotb dpji',
    },
  });

  const mailOptions = {
    from: 'eventsplacemanagement@gmail.com',
    to: email,
    subject: 'Your OTP for Password Reset',
    text: `Your OTP is: ${otp}`,
  };

  try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (error) {
      res.json({ success: false, message: 'Failed to send OTP.' });
  }
});

// Endpoint to verify OTP
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  // Check if OTP exists for the given email
  if (otpStorage[email]) {
      const { otp: storedOtp, expiryTime } = otpStorage[email];

      // Check if OTP has expired
      if (Date.now() > expiryTime) {
          delete otpStorage[email]; // Delete expired OTP
          return res.status(400).json({ success: false, message: 'OTP has expired.' });
      }

      // Compare OTPs
      if (storedOtp === otp) {
          delete otpStorage[email]; // OTP verified, delete from storage
          return res.json({ success: true, message: 'OTP verified successfully.' });
      } else {
          return res.status(400).json({ success: false, message: 'Invalid OTP.' });
      }
  } else {
      return res.status(400).json({ success: false, message: 'OTP not sent or invalid email.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ success: false, message: 'New password is required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash the new password
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true } // Return the updated user
    );

    if (updatedUser) {
      res.json({ success: true, message: 'Password reset successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'User not found.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// DELETE route to cancel booking and remove payment from the collection
app.delete('/api/cancel-booking', async (req, res) => {
  const { bookingID } = req.body;

  try {
      // Find and delete the payment record associated with the booking
      const deletedPayment = await Payment.findOneAndDelete({ bookingID });

      if (!deletedPayment) {
          return res.status(404).json({ success: false, message: "Payment not found." });
      }

      // Optionally, delete the corresponding booking if needed
      const deletedBooking = await Booking.findOneAndDelete({ bookingID });

      res.status(200).json({
          success: true,
          message: "Booking and payment cancelled successfully.",
      });
  } catch (error) {
      console.error("Error canceling booking: ", error);
      res.status(500).json({ success: false, message: "Error canceling booking." });
  }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
