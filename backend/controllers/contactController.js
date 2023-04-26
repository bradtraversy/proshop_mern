const nodemailer = require('nodemailer');
const email_address = process.env.EMAIL_ADDRESS;
const email_password = process.env.EMAIL_PASSWORD;
import Contact from '../models/contactModel';

// @desc    Send email
// @route   POST /api/send-email
// @access  Public
const sendMail = asyncHandler(async (req, res) => {
    const { subject, message } = req.body;
  
    // Make sure all fields are filled in
    if (!subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    const newContact = new Contact({
      subject,
      message,
    });
  
    // Save the contact to the database
    await newContact.save();
  
    // Create a nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: email_address,
        pass: email_password,
      },
    });
  
    // Set up email options
    const mailOptions = {
      from: 'mailer@nodemailer.com',
      to: email_address,
      subject: subject,
      text: message,
    };
  
    // Send email
    try {
      await transporter.sendMail(mailOptions), function(err){
        if(err)
            console.log(err);
        };
      return res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Something went wrong' });
    }
  });
  

export {
    sendMail,
}
