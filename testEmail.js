import dotenv from "dotenv";
import nodemailer from "nodemailer";

// 1. Load .env
dotenv.config();

console.log("------------------------------------------------");
console.log("📧 TESTING EMAIL CONFIGURATION");
console.log("------------------------------------------------");
console.log(`User from .env: ${process.env.EMAIL_USER ? "LOADED ✅" : "MISSING ❌"}`);
console.log(`Pass from .env: ${process.env.EMAIL_PASS ? "LOADED ✅" : "MISSING ❌"}`);

const testSend = async () => {
  try {
    // 2. Setup Transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 3. Verify Connection
    console.log("\n🔄 Connecting to Gmail...");
    await transporter.verify();
    console.log("✅ Connection Successful! Credentials are correct.");

    // 4. Send Test Email
    console.log("🔄 Sending test email...");
    const info = await transporter.sendMail({
      from: `"Test Script" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Sending to yourself
      subject: "Test Email from Food Tracker",
      text: "If you are reading this, your email configuration is PERFECT! 🚀",
    });

    console.log("✅ Email Sent Successfully!");
    console.log("Message ID:", info.messageId);

  } catch (error) {
    console.log("\n❌ ERROR FAILED:");
    console.error(error.message);

    if (error.code === 'EAUTH') {
      console.log("\n👉 HINT: Your Email or App Password is wrong.");
      console.log("   Make sure you are NOT using your normal Gmail password.");
      console.log("   Make sure you generated a new 16-digit App Password.");
    }
  }
};

testSend();