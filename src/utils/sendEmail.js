import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const sendEmail = async (to, subject, text, html = null) => { // 👈 Added html parameter
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Food Expiry Tracker" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text, // Fallback for old email clients
      html: html || text.replace(/\n/g, "<br>"), // 👈 Use HTML if provided, else convert text to HTML
    });
    
    console.log(`📧 Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
  }
};

export default sendEmail;