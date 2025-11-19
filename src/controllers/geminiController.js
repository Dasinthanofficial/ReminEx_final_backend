import { GoogleGenerativeAI } from "@google/generative-ai";
import Product from "../models/Product.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate one short recipe per expiring Food product
 */
export const getRecipeSuggestion = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣  Find expiring "Food" items within 7 days
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    const products = await Product.find({
      user: userId,
      category: "Food",
      expiryDate: { $gte: now, $lte: sevenDaysLater },
    }).limit(5);

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "No food items expiring within 7 days.",
      });
    }

    // 2️⃣  Use the stable model for free‑tier keys
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 3️⃣  Helper functions
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const tryGenerate = async (prompt, retries = 5) => {
      for (let i = 0; i < retries; i++) {
        try {
          const result = await model.generateContent(prompt);
          return result.response.text();
        } catch (err) {
          const msg = err.message || "";
          // Retry on overload (503) or rate limit (429)
          if ((msg.includes("503") || msg.includes("429")) && i < retries - 1) {
            const delay = 2000 * (i + 1); // 2 s → 4 s → 6 s → …
            console.warn(`Gemini busy (attempt ${i + 1}); retrying in ${delay} ms…`);
            await sleep(delay);
            continue;
          }
          throw err;
        }
      }
    };

    // 4️⃣  Generate each recipe sequentially
    const output = [];

    for (const p of products) {
      const prompt = `
You are a friendly home‑cook AI 👩‍🍳😊.

Write a short, realistic recipe that uses *${p.name}* 
(expiring ${p.expiryDate.toDateString()}).

Format clearly with emojis:

🍽️ Dish Name  
🧂 Ingredients  
👨‍🍳 Instructions  
🕒 Total Time (in minutes)  

Keep the recipe under 150 words and easy for beginners.
`;

      try {
        const recipeText = await tryGenerate(prompt);
        output.push({
          id: p._id,
          name: p.name,
          expiryDate: p.expiryDate,
          recipe: recipeText,
        });
      } catch (err) {
        console.error(`❌ Gemini failed for ${p.name}:`, err.message);
        output.push({
          id: p._id,
          name: p.name,
          expiryDate: p.expiryDate,
          recipe: `⚠️ Error generating recipe: ${err.message}`,
        });
      }

      // Slow down between calls to stay within free‑tier limits
      await sleep(3000);
    }

    // 5️⃣  Send the result
    res.json({
      success: true,
      count: output.length,
      recipes: output,
      message: `Generated ${output.length} recipe(s).`,
    });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate recipes.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};