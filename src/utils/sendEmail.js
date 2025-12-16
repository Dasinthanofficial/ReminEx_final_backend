import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const sendEmail = async (to, subject, text, html = null) => {
  // Ensure email config exists
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const err = new Error("Email is not configured (EMAIL_USER or EMAIL_PASS missing).");
    console.error("❌", err.message);
    throw err;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // must be an App Password in production
      },
    });

    const mailOptions = {
      from: `"ReminEx" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    };

    await transporter.sendMail(mailOptions);

    console.log(`📧 Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email send error:", {
      to,
      message: error.message,
      code: error.code,
      command: error.command,
    });
    // IMPORTANT: rethrow so controllers know it failed
    throw error;
  }
};

export default sendEmail;