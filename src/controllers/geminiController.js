// src/controllers/geminiController.js
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

const MAX_QUERY_CHARS = 300; // keep well below MyMemory's 500-char limit

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

// Helper: strip chain-of-thought / reasoning and keep only the recipe
const cleanRecipeText = (raw) => {
  if (!raw) return "";

  const markers = [
    "🍽️",
    "Dish Name",
    "🧂",
    "Ingredients",
    "👨‍🍳",
    "Instructions",
    "Recipe",
  ];

  let pos = Infinity;
  for (const m of markers) {
    const i = raw.indexOf(m);
    if (i !== -1 && i < pos) pos = i;
  }

  if (pos !== Infinity) {
    return raw.slice(pos).trim();
  }

  // Fallback: return original if we can't detect markers
  return raw.trim();
};

/**
 * Generate short recipes in ENGLISH for ALL Food products for this user
 * that expire within the next 7 days, using DeepSeek via OpenRouter.
 */
export const getRecipeSuggestion = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣ Date window: from now up to 7 days ahead
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    // 2️⃣ Find ALL Food products in that window (sorted by expiry)
    const products = await Product.find({
      user: userId,
      category: "Food",
      expiryDate: { $gte: now, $lte: sevenDaysLater },
    })
      .sort({ expiryDate: 1 })
      .lean();

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "No food items expiring within 7 days.",
      });
    }

    const output = [];

    // 3️⃣ Generate recipe for each product sequentially
    for (const product of products) {
      const prompt = `
You are a friendly home‑cook AI.

Write a short, realistic recipe in English that uses *${product.name}*
(expiring on ${new Date(product.expiryDate).toDateString()}).

Format clearly:

🍽️ Dish Name
🧂 Ingredients (bullet list)
👨‍🍳 Instructions (numbered steps)
🕒 Total Time (in minutes)

Keep the recipe under 150 words and easy for beginners.

IMPORTANT:
- Do NOT include your reasoning, analysis, or any explanation.
- Respond ONLY with the final formatted recipe text.
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
        console.error(
          `OpenRouter/DeepSeek failed for ${product.name}:`,
          err.message
        );
        output.push({
          id: product._id,
          name: product.name,
          expiryDate: product.expiryDate,
          recipe: `Error generating recipe: ${err.message}`,
        });
      }

      // Optional small delay to be nicer to rate limits
      await new Promise((r) => setTimeout(r, 200));
    }

    res.json({
      success: true,
      count: output.length,
      recipes: output,
      message: `Generated ${output.length} recipe(s) for items expiring within 7 days.`,
    });
  } catch (error) {
    console.error("OpenRouter/DeepSeek Error (recipes):", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate recipes.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Translate recipe text into a target language using MyMemory API
 * (supports Tamil, Sinhala, etc.; handles long texts by chunking).
 */
export const translateText = async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({
        success: false,
        message: "text and targetLang are required",
      });
    }

    // If asking for English, just return original text
    if (targetLang === "English") {
      return res.json({ success: true, translated: text });
    }

    const targetCode = LANG_CODES[targetLang];
    if (!targetCode) {
      return res.status(400).json({
        success: false,
        message: `Unsupported target language: ${targetLang}`,
      });
    }

    const langpair = `en|${targetCode}`;

    // 1️⃣ Split text into safe-length chunks
    const chunks = splitIntoChunks(text);

    const translatedChunks = [];

    // 2️⃣ Translate each chunk sequentially
    for (const chunk of chunks) {
      const response = await axios.get(
        "https://api.mymemory.translated.net/get",
        {
          params: { q: chunk, langpair },
          timeout: 20000,
        }
      );

      const data = response.data;
      const translatedPart = data?.responseData?.translatedText || null;

      if (!translatedPart) {
        console.error(
          "MyMemory response without translatedText for chunk:",
          data
        );
        return res.status(500).json({
          success: false,
          message: "Translation API returned no result for a chunk",
        });
      }

      translatedChunks.push(translatedPart);

      // Optional: small delay to be nice to the free API
      await new Promise((r) => setTimeout(r, 200));
    }

    // 3️⃣ Join all translated chunks back into one string
    const translated = translatedChunks.join("");

    res.json({ success: true, translated });
  } catch (error) {
    console.error("MyMemory translate error:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });

    res.status(500).json({
      success: false,
      message: "Failed to translate (external API error)",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};