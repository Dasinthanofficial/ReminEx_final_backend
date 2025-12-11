import axios from "axios";
import fs from "fs";
import FormData from "form-data";

const OCR_API_KEY = process.env.OCR_SPACE_KEY; // optional, only if you use OCR

export const scanProductByBarcode = async (req, res) => {
  try {
    const code = req.params.code;
    const url = `https://world.openfoodfacts.org/api/v0/product/${code}.json`;

    const { data } = await axios.get(url);

    if (data.status !== 1 || !data.product) {
      return res.status(404).json({ message: "Product not found in Open Food Facts" });
    }

    const p = data.product;

    // Map fields to your frontend / DB shape
    const productInfo = {
      barcode: code,
      name: p.product_name || "",
      brand: p.brands || "",
      quantity: p.quantity || "",       // e.g. "500 g"
      category: "Food",
      image: p.image_url || "",
      // expiryDate and price will still be provided/confirmed by user
    };

    res.json(productInfo);
  } catch (err) {
    console.error("Scan barcode error:", err.message);
    res.status(500).json({ message: "Failed to scan product" });
  }
};

/**
 * (Optional) POST /api/products/scan/label
 * OCR label image to guess expiry date and weight.
 * Requires OCR_SPACE_KEY in .env (from https://ocr.space/ocrapi)
 * and upload.single("image") in the route.
 */
export const scanLabelImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }
    if (!OCR_API_KEY) {
      return res.status(500).json({ message: "OCR API key not configured" });
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(req.file.path));
    form.append("language", "eng");
    form.append("OCREngine", 2);

    const { data } = await axios.post(
      "https://api.ocr.space/parse/image",
      form,
      {
        headers: {
          ...form.getHeaders(),
          apikey: OCR_API_KEY,
        },
        timeout: 30000,
      }
    );

    const text = data?.ParsedResults?.[0]?.ParsedText || "";

    // Very rough parsing examples:
    // Date patterns: 12/05/2025 or 2025-05-12
    const dateMatch =
      text.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/) ||
      text.match(/\b(\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/);
    const expiryDate = dateMatch ? dateMatch[1] : null;

    // Weight patterns: "500 g", "1 kg", "250 ml", etc.
    const weightMatch = text.match(/\b(\d+\.?\d*)\s*(g|kg|ml|l|L)\b/i);
    const weight = weightMatch ? weightMatch[1] : null;
    const unit = weightMatch ? weightMatch[2] : null;

    res.json({
      rawText: text,
      guessed: { expiryDate, weight, unit },
    });
  } catch (err) {
    console.error("OCR scan error:", err.message);
    res.status(500).json({ message: "Failed to OCR label" });
  } finally {
    // Cleanup temp file if using disk storage
    if (req.file) fs.unlink(req.file.path, () => {});
  }
};