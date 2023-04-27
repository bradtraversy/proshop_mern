import mailgun from 'mailgun-js';

const mailgun_api_key = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN;
const to_email_address = process.env.TO_EMAIL_ADDRESS;
const email_password = process.env.EMAIL_PASSWORD

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

// main().catch(console.error);

//   const mg = mailgun({
//     apiKey: mailgun_api_key,
//     domain: domain
//   });

//   const data = {
//     from: `Sender <sender@${domain}>`,
//     to: to_email_address,
//     subject: subject,
//     text: message
//   };

//   // Send email
//   try {
//     const body = await mg.messages().send(data);
//     console.log('Message sent: ', body);
//     return res.status(200).json({ message: 'Email sent successfully' });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: error });
//     return res.status(500).json({ message: 'Something went wrong' });
//   }
// }




// import nodemailer from 'nodemailer';
// const mailgun_api_key = process.env.MAILGUN_API_KEY;
// const email_address = process.env.EMAIL_ADDRESS;
// const to_email_address = process.env.TO_EMAIL_ADDRESS;
// const email_password = process.env.EMAIL_PASSWORD;
// import mailgun from 'mailgun-js';

// // @desc    Send email
// // @route   POST /api/send-email
// // @access  Public
// const sendMail = async (req, res) => {
//   const { subject, message } = req.body;

//   // Make sure all fields are filled in
//   if (!subject || !message) {
//     return res.status(400).json({ message: 'All fields are required' });
//   }

//   var domain = 'sandbox66a874d4283c47fe9327a8ec63afbfe9.mailgun.org';
//   var mailgun = require('mailgun-js')({apiKey: mailgun_api_key, domain: domain});

//   // create reusable transporter object using the default SMTP transport
//   // create reusable transporter object using the default SMTP transport
//   let transporter = nodemailer.createTransport({
//     host: 'smtp.mailgun.org',
//     port: 587,
//     secure: false, // true for 465, false for other ports
//     auth: {
//       user: email_address, // generated ethereal user
//       pass: email_password, // generated ethereal password
//     },
//   });

//   // send mail with defined transport object
//   let mailOptions = {
//     from: email_address, // sender address
//     to: to_email_address, // list of receivers
//     subject: subject, // Subject line
//     text: message, // plain text body
//   };

//   // Send email
//   try {
//     let info = await transporter.sendMail(mailOptions);
//     console.log("Message sent: %s", info.messageId);
//     return res.status(200).json({ message: 'Email sent successfully' });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: error });
//     return res.status(500).json({ message: 'Something went wrong' });
//   }
// }

// export { sendMail };



    // const formData = require('form-data');
  // const Mailgun = require('mailgun.js');
  // const mailgun = new Mailgun(formData);
  // const mg = mailgun.client({
  // username: 'api',
  // key: '537d004fc7a5fcbecdb83d1a5dd80586-70c38fed-dd7b39d8',
  // });
  // mg.messages
  // .create(sandbox66a874d4283c47fe9327a8ec63afbfe9.mailgun.org, {
  //   from: "Mailgun Sandbox <postmaster@sandbox66a874d4283c47fe9327a8ec63afbfe9.mailgun.org>",
  //   to: ["hollyjordan014@gmail.com"],
  //   subject: "Hello",
  //   text: "Testing some Mailgun awesomness!",
  // })
  // .then(msg => console.log(msg)) // logs response data
  // .catch(err => console.log(err)); // logs any error`;


// You can see a record of this email in your logs: https://app.mailgun.com/app/logs.

// You can send up to 300 emails/day from this sandbox server.
// Next, you should add your own domain so you can send 10000 emails/month for free.
 
// var data = {
//   from: 'Excited User <me@samples.mailgun.org>',
//   to: EMAIL_ADDRESS,
//   subject: subject,
//   text: message
// };

// mailgun.messages().send(data, function (error, body) {
//   console.log(body);
//   });
