require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();

// Use environment variables for port and frontend URL
const port = process.env.PORT || 5002; // Default to 5002 if PORT is not set
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'; // Default to localhost:3000 if FRONTEND_URL is not set

// Enable CORS for the frontend URL
app.use(cors({ origin: frontendUrl }));
app.use(express.json()); // Parse JSON request bodies

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// Define a schema for the application
const applicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  position: { type: String, required: true },
});

const Application = mongoose.model('Application', applicationSchema);

// Configure multer to store files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Use environment variable
    pass: process.env.EMAIL_PASS, // Use environment variable
  },
});

// Configure Twilio
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// API endpoint to handle form submission
app.post('/api/apply', upload.single('cv'), async (req, res) => {
  console.log('Request body:', req.body); // Log the request body
  console.log('Uploaded file:', req.file); // Log the uploaded file

  const { name, email, phone, position } = req.body;

  // Basic input validation
  if (!name || !email || !phone || !position || !req.file) {
    return res.status(400).json({ error: 'All fields are required, including the CV.' });
  }

  try {
    // Save application data to MongoDB (without the file)
    const application = new Application({
      name,
      email,
      phone,
      position,
    });

    await application.save();
    console.log('Application saved to MongoDB');

    // Send email notification with the resume attached
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Your email address
      subject: 'New Job Application Submitted',
      text: `A new job application has been submitted:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nPosition: ${position}`,
      attachments: [
        {
          filename: req.file.originalname, // Use the original file name
          content: req.file.buffer, // Attach the file from memory
        },
      ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });

    // Send WhatsApp notification
    client.messages.create({
      body: `A new job application has been submitted:\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nPosition: ${position}`,
      from: process.env.TWILIO_WHATSAPP_NUMBER, // Twilio's WhatsApp number
      to: process.env.YOUR_WHATSAPP_NUMBER, // Your WhatsApp number
    })
      .then((message) => console.log('WhatsApp message sent:', message.sid))
      .catch((error) => console.error('Error sending WhatsApp message:', error));

    res.status(201).json({ message: 'Application submitted successfully!' });
  } catch (error) {
    console.error('Error saving application:', error);
    res.status(500).json({ error: 'Error submitting application' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
