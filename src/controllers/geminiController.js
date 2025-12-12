import axios from "axios";
import Product from "../models/Product.js";
import { callOpenRouter } from "../utils/openRouterClient.js";

// Language-code mapping for MyMemory
const LANG_CODES = {
  Tamil: "ta",
  Sinhala: "si",
  Hindi: "hi",
  Arabic: "ar",
  Spanish: "es",
  French: "fr",
  English: "en",
};

const MAX_QUERY_CHARS = 300; // safe below MyMemory limit

// Helper: split text into safe-length chunks
const splitIntoChunks = (text, maxLen = MAX_QUERY_CHARS) => {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
};

// Helper: clean recipe text
const cleanRecipeText = (raw) => {
  if (!raw) return "";

  const markers = ["🍽️ Dish Name:", "Dish Name:", "🧂 Ingredients:", "👨‍🍳 Instructions:"];
  let pos = Infinity;
  for (const m of markers) {
    const idx = raw.indexOf(m);
    if (idx !== -1 && idx < pos) pos = idx;
  }

  return pos !== Infinity ? raw.slice(pos).trim() : raw.trim();
};

/**
 * Generate short, playful recipes in ENGLISH for all Food products
 * expiring within 7 days using DeepSeek via OpenRouter.
 */
export const getRecipeSuggestion = async (req, res) => {
  try {
    const userId = req.user._id;

    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    const products = await Product.find({
      user: userId,
      category: "Food",
      expiryDate: { $gte: now, $lte: sevenDaysLater },
    }).sort({ expiryDate: 1 }).lean();

    if (!products.length) {
      return res.status(404).json({ success: false, message: "No food items expiring within 7 days." });
    }

    const output = [];

    for (const product of products) {
      const expStr = new Date(product.expiryDate).toDateString();

      const prompt = `
You are a fun, friendly home cook helping someone reduce food waste by using ingredients that are close to their expiry date.

Write ONE short, realistic recipe in friendly, natural English that uses *${product.name}* as a key ingredient
(expiring on ${expStr}). Focus on everyday home cooking, not restaurant style.

Tone:
- Light and playful.
- Add 1–2 small, funny comments in the instructions (e.g., "don't burn it, we want dinner, not charcoal").
- Recipe first, jokes second.

Output the recipe using EXACTLY this structure:

🍽️ Dish Name: <simple, appealing name>
🧂 Ingredients:
• <ingredient 1>
• <ingredient 2>
• <ingredient 3>
👨‍🍳 Instructions:
1. <step 1 with a tiny joke or friendly remark>
2. <step 2>
3. <step 3 with a playful note>
🕒 Total Time: <number> minutes

Constraints:
- Under 150 words.
- Easy for beginners.
- Use common home ingredients.
- Do NOT mention expiry dates or being AI.
- Do NOT include reasoning or analysis.
- Do NOT repeat any example or sample recipes.
- Respond ONLY with the final recipe in the format above.
`;

      try {
        const rawText = await callOpenRouter(prompt);
        const recipeText = cleanRecipeText(rawText);

        output.push({
          id: product._id,
          name: product.name,
          expiryDate: product.expiryDate,
          recipe: recipeText,
        });
      } catch (err) {
        console.error(`OpenRouter failed for ${product.name}:`, err.message);
        output.push({
          id: product._id,
          name: product.name,
          expiryDate: product.expiryDate,
          recipe: `Error generating recipe: ${err.message}`,
        });
      }

      await new Promise((r) => setTimeout(r, 200)); // rate-limit friendly
    }

    res.json({
      success: true,
      count: output.length,
      recipes: output,
      message: `Generated ${output.length} recipe(s) for items expiring within 7 days.`,
    });
  } catch (error) {
    console.error("OpenRouter Error (recipes):", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate recipes.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Translate recipe text into a target language using MyMemory API
 */
export const translateText = async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ success: false, message: "text and targetLang are required" });
    }

    if (targetLang === "English") return res.json({ success: true, translated: text });

    const targetCode = LANG_CODES[targetLang];
    if (!targetCode) return res.status(400).json({ success: false, message: `Unsupported target language: ${targetLang}` });

    const langpair = `en|${targetCode}`;
    const chunks = splitIntoChunks(text);
    const translatedChunks = [];

    for (const chunk of chunks) {
      const response = await axios.get("https://api.mymemory.translated.net/get", {
        params: { q: chunk, langpair },
        timeout: 20000,
      });

      const translatedPart = response.data?.responseData?.translatedText;
      if (!translatedPart) {
        console.error("MyMemory missing translatedText:", response.data);
        return res.status(500).json({ success: false, message: "Translation API returned no result for a chunk" });
      }

      translatedChunks.push(translatedPart);
      await new Promise((r) => setTimeout(r, 200)); // polite delay
    }

    res.json({ success: true, translated: translatedChunks.join("") });
  } catch (error) {
    console.error("MyMemory translate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to translate",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
