import axios from "axios";
import Product from "../models/Product.js";
import RecipeSuggestion from "../models/RecipeSuggestion.js";
import { callOpenRouter } from "../utils/openRouterClient.js";
import { startOfLocalDay } from "../utils/dates.js";

const LANG_CODES = {
  Tamil: "ta",
  Sinhala: "si",
  Hindi: "hi",
  Arabic: "ar",
  Spanish: "es",
  French: "fr",
  English: "en",
};

const MAX_QUERY_CHARS = 300;

const splitIntoChunks = (text, maxLen = MAX_QUERY_CHARS) => {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
};

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

// Local YYYY-MM-DD (stable)
const toLocalDateKey = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getRecipeSuggestion = async (req, res) => {
  try {
    const userId = req.user._id;

    // ✅ include "expires today"
    const today = startOfLocalDay();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // ✅ fetch ALL products expiring within 7 days (no limit)
    const products = await Product.find({
      user: userId,
      category: "Food",
      expiryDate: { $gte: today, $lte: sevenDaysLater },
    })
      .sort({ expiryDate: 1 })
      .lean();

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "No food items expiring within 7 days.",
      });
    }

    // ✅ preload cache docs for performance (avoid findOne inside loop)
    const productIds = products.map((p) => p._id);
    const cachedDocs = await RecipeSuggestion.find({
      user: userId,
      product: { $in: productIds },
    }).lean();

    const cacheMap = new Map(); // key = `${productId}:${expiryKey}`
    for (const doc of cachedDocs) {
      cacheMap.set(`${doc.product.toString()}:${doc.expiryKey}`, doc);
    }

    const output = [];

    for (const product of products) {
      const expiryKey = toLocalDateKey(product.expiryDate);
      const mapKey = `${product._id.toString()}:${expiryKey}`;

      let cached = cacheMap.get(mapKey);

      // ✅ reuse if cached
      if (cached) {
        output.push({
          id: product._id,
          name: product.name,
          expiryDate: product.expiryDate,
          recipe: cached.recipeText,
          cached: true,
        });
        continue;
      }

      // ✅ generate once if not cached
      const expStr = new Date(product.expiryDate).toDateString();

      const prompt = `
You are a fun, friendly home cook helping someone reduce food waste by using ingredients that are close to their expiry date.

Write ONE short, realistic recipe in friendly, natural English that uses *${product.name}* as a key ingredient
(expiring on ${expStr}). Focus on everyday home cooking, not restaurant style.

Tone:
- Light and playful.
- Add 1–2 small, funny comments in the instructions.
- Recipe first, jokes second.

Output EXACTLY:

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
- Respond ONLY with the final recipe in the format above.
`;

      let recipeText;
      try {
        const rawText = await callOpenRouter(prompt);
        recipeText = cleanRecipeText(rawText);
      } catch (err) {
        console.error(`OpenRouter failed for ${product.name}:`, err.message);

        recipeText =
          err.response?.status === 429
            ? "Recipe AI is rate-limited right now. Please try again later."
            : "Recipe AI is currently unavailable. Please try again later.";
      }

      // ✅ upsert persistent cache
      const saved = await RecipeSuggestion.findOneAndUpdate(
        { user: userId, product: product._id, expiryKey },
        {
          user: userId,
          product: product._id,
          expiryKey,
          expiryDate: product.expiryDate,
          recipeText,
          provider: "openrouter",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      cacheMap.set(mapKey, saved);

      output.push({
        id: product._id,
        name: product.name,
        expiryDate: product.expiryDate,
        recipe: saved.recipeText,
        cached: false,
      });

      // small delay to reduce 429 if many items
      await new Promise((r) => setTimeout(r, 150));
    }

    return res.json({
      success: true,
      count: output.length,
      recipes: output,
      message: `Returned recipes for ${output.length} item(s) expiring within 7 days.`,
    });
  } catch (error) {
    console.error("OpenRouter Error (recipes):", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate recipes.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const translateText = async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({
        success: false,
        message: "text and targetLang are required",
      });
    }

    if (targetLang === "English") return res.json({ success: true, translated: text });

    const targetCode = LANG_CODES[targetLang];
    if (!targetCode) {
      return res.status(400).json({
        success: false,
        message: `Unsupported target language: ${targetLang}`,
      });
    }

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
        return res.status(500).json({
          success: false,
          message: "Translation API returned no result for a chunk",
        });
      }

      translatedChunks.push(translatedPart);
      await new Promise((r) => setTimeout(r, 200));
    }

    return res.json({ success: true, translated: translatedChunks.join("") });
  } catch (error) {
    console.error("MyMemory translate error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to translate",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};