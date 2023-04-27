const mailgun_api_key = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN;
const email_password = process.env.MAILGUN_PASSWORD;
const to_email_address = process.env.TO_EMAIL_ADDRESS;

import nodemailer from 'nodemailer' 

// @desc    Send email
// @route   POST /api/send-email
// @access  Public
const sendMail = async (req, res) => {
  // const { subject, message } = req.body;
  const subject = req.body['subject']['subject'];
  const message = req.body['subject']['message'];

  // problem with how you're sending it
  console.log("In contact controller (sendMail)!!!")
  console.log('subject', subject)
  console.log('message', message)

  // Make sure all fields are filled in
  if (!subject || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  console.log("past error 400")

  // create reusable transporter object using the default SMTP transport 
  var transporter = nodemailer.createTransport({
    service: 'smtp.mailgun.org',
    port: 587,
    auth: {
      user: domain,
      pass: email_password
    }
  });

  console.log("Past transporter")

  var mailOptions = {
    from: domain,
    to: domain,
    subject: 'Sending Email using Node.js',
    text: 'That was easy!'
  };

  console.log("Past mail options")

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  }); 

  console.log("Past transporter Send Mail")
}

export { sendMail };
