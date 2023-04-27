import nodemailer from 'nodemailer';

const email_address = process.env.EMAIL_ADDRESS;
const email_password = process.env.EMAIL_PASSWORD;

// @desc    Send email
// @route   POST /api/send-email
// @access  Public
const sendMail = async (req, res) => {
  const { subject, message } = req.body;

  // Make sure all fields are filled in
  if (!subject || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: email_address, // generated ethereal user
      pass: email_password, // generated ethereal password
    },
  });

  // send mail with defined transport object
  let mailOptions = {
    from: email_address, // sender address
    to: email_address, // list of receivers
    subject: subject, // Subject line
    text: message, // plain text body
    html: `<p>${message}</p>`, // html body
  };

  // Send email
  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error });
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

export { sendMail };
