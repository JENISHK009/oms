import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { logEmail } from './index.js';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE || true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_EMAIL_PASSWORD,
  },
});

const sendEmail = async (toEmail, body, subject) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: toEmail,
      subject: subject,
      html: body,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);

    await logEmail({
      recipient: toEmail,
      subject: subject,
      body: body,
      status: 'Sent',
      errorMessage: null,
    });

    return info.response;
  } catch (error) {
    console.error('Error sending email:', error.message);

    await logEmail({
      recipient: toEmail,
      subject: subject,
      body: body,
      status: 'Failed',
      errorMessage: error.message,
    });

    throw new Error('Failed to send email: ' + error.message);
  }
};

export { sendEmail };
