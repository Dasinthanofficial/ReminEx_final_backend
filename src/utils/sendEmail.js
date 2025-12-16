import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@example.com";

const sendEmail = async (to, subject, text, html = null) => {
  if (!RESEND_API_KEY) {
    const err = new Error("RESEND_API_KEY is not set");
    console.error("❌", err.message);
    throw err;
  }

  try {
    const body = {
      from: `ReminEx <${FROM_EMAIL}>`,
      to: [to],
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    };

    const res = await axios.post("https://api.resend.com/emails", body, {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    console.log(`📧 Email sent to ${to}`, res.data);
  } catch (error) {
    console.error("❌ Email send error (Resend):", {
      to,
      message: error.response?.data || error.message,
    });
    throw error;
  }
};

export default sendEmail;