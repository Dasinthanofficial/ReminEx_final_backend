import { GoogleGenerativeAI } from "@google/generative-ai";
import Product from "../models/Product.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getRecipeSuggestion = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣ Fetch food products expiring within 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const expiringProducts = await Product.find({
      user: userId,
      category: "Food",
      expiryDate: { $gte: now, $lte: sevenDaysFromNow },
    }).limit(10);

    if (expiringProducts.length === 0) {
      return res.status(404).json({
        message: "No food products expiring soon. Add items with expiry dates within the next 7 days.",
      });
    }

    // 2️⃣ Build prompt
    const expiryList = expiringProducts
      .map((p) => `${p.name} (expires ${p.expiryDate.toDateString()})`)
      .join("\n");

    const prompt = `
You are a friendly cooking assistant. I have these ingredients expiring soon:

${expiryList}

Create one simple, delicious recipe that uses as many of these as possible.
Include:
1. A recipe name
2. Ingredients list with quantities
3. Step-by-step instructions
4. Total cooking time
Make it easy and realistic!
`;

    // 3️⃣ Call Gemini - ✅ FIXED: Use correct model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    // 4️⃣ Respond
    res.json({
      success: true,
      recipe: text,
      expiringProducts: expiringProducts.map((p) => ({
        id: p._id,
        name: p.name,
        expiryDate: p.expiryDate,
        daysUntilExpiry: Math.ceil(
          (new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24)
        ),
      })),
      message: `Recipe suggestion based on ${expiringProducts.length} expiring product(s)`,
    });
  } catch (error) {
    console.error("Gemini API Error:", error);

    if (error.message?.includes("API key")) {
      return res.status(500).json({
        message: "AI service configuration error. Check your GEMINI_API_KEY in .env.",
      });
    }

    res.status(500).json({
      message: "Failed to generate recipe suggestion. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};