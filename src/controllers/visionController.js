// backend/src/controllers/visionController.js
import { askVisionModel } from "../utils/hfVisionClient.js";

/**
 * POST /api/products/predict-image
 * Form-data: image (file)
 * Uses HF vision model to caption the image, then heuristics to guess condition & days.
 */
export const predictSpoilageFromImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ success: false, message: "No image uploaded" });
    }

    // 1️⃣ Get caption from HF vision model
    const caption = await askVisionModel(req.file.buffer);
    console.log("Caption from HF vision model:", caption);

    // 2️⃣ Simple heuristic based on caption text
    const lower = caption.toLowerCase();

    let condition = "fresh";
    let days = 5;

    // Very rough rules:
    if (
      lower.includes("mold") ||
      lower.includes("mould") ||
      lower.includes("rotten") ||
      lower.includes("rot") ||
      lower.includes("decay") ||
      lower.includes("spoiled") ||
      lower.includes("bad")
    ) {
      condition = "rotting";
      days = 0; // basically unsafe now
    } else if (
      lower.includes("brown") ||
      lower.includes("spot") ||
      lower.includes("bruise") ||
      lower.includes("soft") ||
      lower.includes("damaged") ||
      lower.includes("blemish")
    ) {
      condition = "slightly damaged";
      days = 2; // use soon
    } else {
      condition = "fresh";
      days = 5; // default for good-looking produce
    }

    // 3️⃣ Compute expiry date: today + days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + days);

    res.json({
      success: true,
      condition,
      days,
      notes: caption, // show caption as note
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