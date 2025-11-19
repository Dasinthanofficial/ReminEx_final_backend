import { GoogleGenerativeAI } from "@google/generative-ai";
import Product from "../models/Product.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate one recipe per expiring food product.
 */
export const getRecipeSuggestion = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣ Find Food items expiring within 7 days
    const now = new Date();
    const sevenDays = new Date(now);
    sevenDays.setDate(now.getDate() + 7);

    const expiringProducts = await Product.find({
      user: userId,
      category: "Food",
      expiryDate: { $gte: now, $lte: sevenDays },
    }).limit(10);

    if (!expiringProducts.length) {
      return res.status(404).json({
        message:
          "No food products expiring soon. Add some items that expire within the next 7 days.",
      });
    }

    // 2️⃣ Prepare Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3️⃣ Iterate through products and generate a recipe for each one
    const recipeResults = [];
    for (const product of expiringProducts) {
      const prompt = `
You are a friendly home‑cook AI assistant.
Give me ONE simple, tasty recipe that mainly features *${product.name}*,
which expires on ${product.expiryDate.toDateString()}.

Include:
1.Recipe name
2.Short introduction (1–2 lines)
3.Ingredients list with realistic quantities
4.Step‑by‑step cooking instructions
5.Total cooking time
Keep it brief and practical for everyday cooking.
`;

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        recipeResults.push({
          id: product._id,
          name: product.name,
          expiryDate: product.expiryDate,
          recipe: text,
        });
      } catch (innerErr) {
        console.warn(`Gemini failed for ${product.name}:`, innerErr.message);
        recipeResults.push({
          id: product._id,
          name: product.name,
          expiryDate: product.expiryDate,
          recipe: "*Error generating recipe for this product.*",
        });
      }
    }

    // 4️⃣ Respond
    res.json({
      success: true,
      count: recipeResults.length,
      recipes: recipeResults,
      message: `Generated ${recipeResults.length} recipes for expiring product(s).`,
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API key")) {
      return res.status(500).json({
        message: "AI service configuration error. Check GEMINI_API_KEY in .env.",
      });
    }
    res.status(500).json({
      message: "Failed to generate recipe suggestions.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};