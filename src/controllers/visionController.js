// backend/src/controllers/visionController.js
import { analyzeImageWithGemini } from "../utils/geminiVisionClient.js";

/**
 * Extract + parse a JSON object from model output.
 * Handles code fences and some common formatting issues.
 */
const tryParseJsonFromText = (raw = "") => {
  let s = String(raw || "").trim();

  // remove markdown fences
  s = s.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // If there's a JSON object somewhere, slice from first { to last }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }

  // fix trailing commas like {"a":1,}
  s = s.replace(/,\s*}/g, "}");

  // attempt parse
  return JSON.parse(s);
};

/**
 * If JSON parsing fails, try to extract fields via regex.
 * This prevents "default fallback" when Gemini returns slightly malformed JSON.
 */
const tryExtractFieldsHeuristically = (raw = "") => {
  const s = String(raw || "");

  const condMatch = s.match(/"condition"\s*:\s*"([^"]+)"/i);
  const daysMatch = s.match(/"days"\s*:\s*(-?\d+)/i);
  const notesMatch = s.match(/"notes"\s*:\s*"([^"]*)"/i);

  const condition = condMatch?.[1]?.trim();
  let days = daysMatch ? parseInt(daysMatch[1], 10) : NaN;
  const notes = notesMatch?.[1]?.trim();

  // If days missing, infer from condition
  if (Number.isNaN(days)) {
    if (condition?.toLowerCase().includes("rott")) days = 0;
    else if (condition?.toLowerCase().includes("slight")) days = 2;
    else days = 5;
  }

  return {
    condition: condition || "fresh",
    days,
    notes: notes || "Heuristic parse (AI output was not clean JSON).",
  };
};

export const predictSpoilageFromImage = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    console.log("📸 Starting Gemini image analysis...");

    let result = null;
    let aiUsed = false;

    // Try Gemini analysis
    try {
      const modelText = await analyzeImageWithGemini(base64Image, mimeType);
      console.log("✅ Raw Gemini response:", String(modelText).slice(0, 150));

      try {
        result = tryParseJsonFromText(modelText);
        aiUsed = true;
        console.log("✅ Gemini analysis successful (JSON):", result);
      } catch {
        // fallback parse
        result = tryExtractFieldsHeuristically(modelText);
        aiUsed = true;
        console.warn("⚠️ Gemini returned non-clean JSON. Used heuristic parse:", result);
      }
    } catch (aiErr) {
      console.warn("⚠️ Gemini AI failed:", aiErr.message);
    }

    // Default fallback if AI totally failed
    if (!result) {
      console.log("📊 Using default produce estimate (AI unavailable)");
      result = {
        condition: "fresh",
        days: 5,
        notes:
          "Standard fresh produce estimate. Please adjust if needed based on visual inspection.",
      };
      aiUsed = false;
    }

    // Normalize days
    let days = parseInt(result.days, 10);
    if (Number.isNaN(days) || days < 0) {
      days = 5;
      console.warn("⚠️ Invalid days value, using default: 5");
    }
    if (days > 14) {
      days = 14;
      console.warn("⚠️ Days capped at maximum: 14");
    }

    // Calculate expiry date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + days);

    const payload = {
      success: true,
      condition: result.condition || "fresh",
      days,
      notes: result.notes || "Analysis complete",
      expiryDate,
      expiryDateISO: expiryDate.toISOString().slice(0, 10),
      aiUsed,
      method: aiUsed ? "gemini" : "default",
    };

    console.log(`✅ Prediction complete: ${days} days (method: ${payload.method})`);
    return res.json(payload);
  } catch (err) {
    console.error("❌ Vision endpoint error:", err);

    // Final fallback
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + 5);

    return res.json({
      success: true,
      condition: "fresh",
      days: 5,
      notes: "Default 5-day estimate. Please adjust based on visual inspection.",
      expiryDate,
      expiryDateISO: expiryDate.toISOString().slice(0, 10),
      aiUsed: false,
      method: "fallback",
    });
  }
};