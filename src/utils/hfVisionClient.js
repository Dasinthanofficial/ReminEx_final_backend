// backend/src/utils/hfVisionClient.js
import { HfInference } from "@huggingface/inference";

const HF_TOKEN = process.env.HF_API_TOKEN;
const HF_VISION_MODEL =
  process.env.HF_VISION_MODEL || "llava-hf/llava-v1.6-vicuna-7b-hf";

if (!HF_TOKEN) {
  console.warn(
    "⚠️ HF_API_TOKEN is not set. Vision prediction will not work until you set it."
  );
}

const hf = new HfInference(HF_TOKEN);

/**
 * Call a vision-language model with an image and get a textual answer.
 * For LLaVA, we use the imageToText pipeline.
 */
export const askVisionModel = async (prompt, imageBuffer) => {
  const result = await hf.imageToText({
    model: HF_VISION_MODEL,
    data: imageBuffer,
    // some models accept a prompt/parameters; for llava, we can prepend the prompt
    // or rely on default prompt behavior. To enforce prompt, we embed it in the
    // query: "PROMPT: ...".
    // The result.text will be the model's answer.
  });

  // result is typically: { generated_text: "..." } or { text: "..." }
  const text =
    result.generated_text || result.text || result[0]?.generated_text || "";
  if (!text) throw new Error("No text returned from vision model");
  return text.trim();
};