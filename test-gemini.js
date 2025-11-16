import 'dotenv/config.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

(async () => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Say hello from Gemini!");
    console.log("✅ Response:", await result.response.text());
  } catch (e) {
    console.error("❌ Gemini error:", e.message);
  }
})();