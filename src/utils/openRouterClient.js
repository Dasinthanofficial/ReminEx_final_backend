// backend/src/utils/openRouterClient.js
import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Recipe generation model
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

// Vision model for image analysis
const OPENROUTER_VISION_MODEL = 
  process.env.OPENROUTER_VISION_MODEL || "google/gemini-2.0-flash-exp:free";

const OPENROUTER_REFERRER =
  process.env.OPENROUTER_REFERRER || "https://your-frontend-url.com";

/**
 * Call OpenRouter for text-only recipe generation
 */
export const callOpenRouter = async (prompt) => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful cooking assistant. You may think privately, but in your final response you MUST NOT include any explanation, thoughts, or analysis. Only output the final recipe in the requested format.",
        },
        {
          role: "user",
          content: `${prompt}

IMPORTANT:
- Do NOT include your reasoning or preamble.
- Respond ONLY with the final recipe text in the requested format.`,
        },
      ],
      max_tokens: 512,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERRER,
        "X-Title": "ReminEx AI Chef",
      },
      timeout: 40000,
    }
  );

  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No content returned from OpenRouter");
  return text.trim();
};

/**
 * Call OpenRouter vision model with image
 * @param {string} prompt - Text prompt for analysis
 * @param {string} base64Image - Base64 encoded image
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg')
 * @returns {Promise<string>} - Model response text
 */
export const callOpenRouterVision = async (prompt, base64Image, mimeType = 'image/jpeg') => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: OPENROUTER_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 150, // Reduced for faster response
        temperature: 0.2, // Lower temperature for consistent analysis
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": OPENROUTER_REFERRER,
          "X-Title": "ReminEx Vision Analyzer",
        },
        timeout: 45000,
      }
    );

    const text = res.data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("No content returned from OpenRouter Vision");
    return text.trim();
  } catch (error) {
    // Log detailed error for debugging
    console.error("OpenRouter Vision API Error:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // Re-throw with better error message
    if (error.response?.status === 429) {
      const retryAfter = error.response?.headers['retry-after'] || '60';
      throw new Error(`Rate limit exceeded. Please wait ${retryAfter} seconds.`);
    }
    
    throw error;
  }
};