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
  console.log("")
  console.log('Subject: ', subject)
  console.log('Message:', message)
  console.log("")

  // Make sure all fields are filled in
  if (!subject || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  console.log("Past error 400")

  // create reusable transporter object using the default SMTP transport 
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD,
    }
  });

  console.log("Past transporter")

  var mailOptions = {
    from: process.env.EMAIL_ADDRESS,
    to: process.env.EMAIL_ADDRESS,
    subject: subject,
    text: message
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
