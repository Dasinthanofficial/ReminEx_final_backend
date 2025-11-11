import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGemini() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Say hello from Gemini!");
    console.log("✅ Gemini Response:\n", result.response.text());
  } catch (error) {
    console.error("❌ Gemini API Error:", error.message);
  }
}

testGemini();
