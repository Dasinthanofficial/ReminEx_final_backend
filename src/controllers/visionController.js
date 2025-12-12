// backend/src/controllers/visionController.js
import { askVisionModel } from "../utils/hfVisionClient.js";

/**
 * POST /api/products/predict-image
 * Form-data: image (file)
 * Uses HF vision model to guess condition & days until spoilage.
 */
export const predictSpoilageFromImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ success: false, message: "No image uploaded" });
    }

    const prompt = `
You see a photo of fresh produce (fruits or vegetables).

Task:
1. Judge the visible condition as one of:
   - "fresh"
   - "slightly damaged"
   - "rotting"
   - "unsafe"
2. Estimate in how many whole days from today it will likely NOT be good to eat,
   assuming typical home storage.
3. Return ONLY a JSON object in exactly this format:

{
  "condition": "fresh" | "slightly damaged" | "rotting" | "unsafe",
  "days": <integer between 0 and 14>,
  "notes": "<very short explanation in one sentence>"
}

Do not include any extra text outside of the JSON.
`;

    const raw = await askVisionModel(prompt, req.file.buffer);

    let condition = "fresh";
    let days = 3;
    let notes = "";

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.condition === "string") {
        condition = parsed.condition;
      }
      if (
        typeof parsed.days === "number" &&
        parsed.days >= 0 &&
        parsed.days <= 14
      ) {
        days = Math.round(parsed.days);
      }
      if (typeof parsed.notes === "string") {
        notes = parsed.notes;
      }
    } catch (err) {
      console.error(
        "predictSpoilageFromImage: JSON parse error:",
        err.message,
        "raw:",
        raw
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + days);

    res.json({
      success: true,
      condition,
      days,
      notes,
      expiryDate,
      expiryDateISO: expiryDate.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error("Vision spoilage error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to analyze image",
    });
  }
};