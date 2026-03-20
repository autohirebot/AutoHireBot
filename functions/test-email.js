const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtppro.zoho.in',
  port: 465,
  secure: true,
  auth: {
    user: 'admin@autohirebot.com',
    pass: 'qZMQbKjbnndR'
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ SMTP works!');
  }
  process.exit();
});