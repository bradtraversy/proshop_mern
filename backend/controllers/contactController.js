const mailgun_api_key = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN;
const email_password = process.env.MAILGUN_PASSWORD;
const to_email_address = process.env.TO_EMAIL_ADDRESS;

// @desc    Send email
// @route   POST /api/send-email
// @access  Public
const sendMail = async (req, res) => {
  const { subject, message } = req.body;
  console.log("HERE!!!")

  // Make sure all fields are filled in
  if (!subject || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // create reusable transporter object using the default SMTP transport 
  let transporter = nodemailer.createTransport({
    host: "smtp.mailgun.org", 
    port: 587, 
    auth: {
      user: `postmaster@${domain}`,
      pass: email_password,
    },

  });

  // send mail with defined transport object 
  let info = await transporter.sendMail({
    from: `sender@${DOMAIN}`, 
    to: to_email_address, 
    subject: subject, 
    text: message,
  });

  console.log(`Message sent: ${info.messageId}`);

}

export { sendMail };
