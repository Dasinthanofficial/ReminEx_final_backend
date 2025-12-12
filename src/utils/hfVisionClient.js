// backend/src/utils/hfVisionClient.js
import { HfInference } from "@huggingface/inference";

const HF_TOKEN = process.env.HF_API_TOKEN;

// Default to a captioning model that supports image-to-text.
// You can override with HF_VISION_MODEL in .env if needed.
const HF_VISION_MODEL =
  process.env.HF_VISION_MODEL || "nlpconnect/vit-gpt2-image-captioning";

if (!HF_TOKEN) {
  console.warn(
    "⚠️ HF_API_TOKEN is not set. Vision prediction will NOT work until you set it in the backend .env."
  );
}

const hf = new HfInference(HF_TOKEN);

/**
 * Call a captioning model with an image and get a textual caption.
 * Uses the imageToText pipeline with Hugging Face's own inference provider.
 *
 * @param {Buffer} imageBuffer - Raw image buffer (from multer.memoryStorage)
 * @returns {Promise<string>} - The caption text
 */
export const askVisionModel = async (imageBuffer) => {
  try {
    const result = await hf.imageToText({
      model: HF_VISION_MODEL,
      data: imageBuffer,
      provider: "hf-inference", // 👈 force Hugging Face Inference provider
    });

    // result is usually { generated_text: "..." } but we handle a few shapes
    const text =
      result.generated_text ||
      result.text ||
      (Array.isArray(result) && result[0]?.generated_text) ||
      "";

    if (!text) {
      throw new Error("No text returned from vision model");
    }

    return text.trim();
  } catch (error) {
    console.error(
      "HF vision API error:",
      error.response?.status,
      error.response?.data || error.message
    );
    throw error;
  }
};