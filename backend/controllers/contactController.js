import nodemailer from 'nodemailer' 

// @desc    Send email
// @route   POST /api/send-email
// @access  Public
const sendMail = async (req, res) => {
  // Get the subject and message the user entered from the request body
  const subject = req.body['subject']['subject'];
  const message = req.body['subject']['message'];

  // Make sure all fields are filled in
  if (!subject || !message) {
    // If all fields are not filled in, show an error message
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Create reusable transporter object using the default SMTP transport 
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      // Email address defined in .env file
      user: process.env.EMAIL_ADDRESS,
      // Email app password defined in .env file
      pass: process.env.EMAIL_PASSWORD,
    }
  });

  // Set the email options
  var mailOptions = {
    from: process.env.EMAIL_ADDRESS,
    to: process.env.EMAIL_ADDRESS,
    // Set the subject to the subject the user entered on the form
    subject: subject,
    // Set the message to the message the user entered on the form
    text: message
  };

  // Send the email
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      // Log error if failed
      console.log(error);
    } else {
      // Log the email was sent
      console.log('Email sent: ' + info.response);
    }
  }); 
}

export { sendMail };
