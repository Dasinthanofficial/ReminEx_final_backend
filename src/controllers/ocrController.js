import sharp from "sharp";
import { createWorker } from "tesseract.js";

/**
 * Cache workers per language so we don't re-initialize every request.
 * lang examples: "eng", "eng+tam", "eng+sin"
 */
const workerCache = new Map();

async function getWorker(lang = "eng") {
  const key = lang || "eng";
  if (workerCache.has(key)) return workerCache.get(key);

  const p = (async () => {
    const worker = await createWorker({ logger: () => {} });

    // Tesseract.js supports combined langs like "eng+tam" if traineddata is available
    await worker.loadLanguage(key);
    await worker.initialize(key);

    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/.-,:₹$€£()% ",
    });

    return worker;
  })();

  workerCache.set(key, p);
  return p;
}

async function preprocess(buffer) {
  // Strong preprocessing for packaging text
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(180)
    .toBuffer();
}

function cleanText(t = "") {
  return String(t)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeUnit(u = "") {
  const x = String(u).trim().toLowerCase();
  if (x === "l") return "L";
  if (x === "ml") return "ml";
  if (x === "g") return "g";
  if (x === "kg") return "kg";
  if (x === "pc" || x === "pcs" || x === "piece" || x === "pieces") return "pcs";
  return "";
}

function parseNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseExpiryISO(text) {
  const t = String(text || "");
  const lines = t.split("\n").map((x) => x.trim()).filter(Boolean);

  const keyLines = lines.filter((l) =>
    /(exp|expiry|best before|use by|bb|expires)/i.test(l)
  );

  const scope = (keyLines.length ? keyLines : lines).join("\n");

  // YYYY-MM-DD or YYYY/MM/DD
  let m = scope.match(/\b(20\d{2})[-\/\.](\d{1,2})[-\/\.](\d{1,2})\b/);
  if (m) {
    const y = Number(m[1]);
    const mo = String(Number(m[2])).padStart(2, "0");
    const d = String(Number(m[3])).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  m = scope.match(/\b(\d{1,2})[-\/\.](\d{1,2})[-\/\.](20\d{2})\b/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return "";
}

function parsePrice(text) {
  const t = String(text || "");

  // Rs / LKR / $ / € / £ / ₹ + amount
  const currency = [
    ...t.matchAll(/(?:₹|rs\.?|lkr|usd|\$|€|£)\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi),
  ]
    .map((m) => parseNumber(m[1]))
    .filter((n) => n != null);

  // MRP / PRICE / AMOUNT
  const keyword = [
    ...t.matchAll(/\b(?:mrp|price|amount)\s*[:\-]?\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi),
  ]
    .map((m) => parseNumber(m[1]))
    .filter((n) => n != null);

  // e.g. "1250/-"
  const slashDash = [
    ...t.matchAll(/\b([0-9][0-9,]*\.?[0-9]{0,2})\s*\/-\b/g),
  ]
    .map((m) => parseNumber(m[1]))
    .filter((n) => n != null);

  const all = [...currency, ...keyword, ...slashDash]
    .filter((n) => n > 0 && n < 100000); // avoid barcode-like huge numbers

  if (!all.length) return null;
  return Math.max(...all);
}

function parseQuantity(text) {
  const t = String(text || "");

  // "500g", "500 g", "0.5 kg", "750ml", "1L", "12 pcs"
  const m = t.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|ml|l|L|pcs|pc|pieces|piece)\b/i);
  if (!m) return { quantityNumber: null, quantityUnit: "" };

  return {
    quantityNumber: parseNumber(m[1]),
    quantityUnit: normalizeUnit(m[2]),
  };
}

function guessCategory(text) {
  const t = String(text || "").toLowerCase();
  const nonFood = [
    "shampoo", "soap", "detergent", "toothpaste", "cleaner", "lotion",
    "cream", "battery", "deodorant", "sanitizer", "dishwash",
  ];
  const food = [
    "milk", "bread", "rice", "sugar", "salt", "snack", "chocolate",
    "biscuit", "juice", "tea", "coffee", "cereal", "noodles", "pasta",
    "cheese", "yogurt", "butter", "oil", "flour", "spice",
    "fruit", "vegetable",
  ];

  if (nonFood.some((k) => t.includes(k))) return "Non-Food";
  if (food.some((k) => t.includes(k))) return "Food";
  return "Food";
}

function guessName(frontText, backText) {
  const t = cleanText(frontText || backText || "");
  const lines = t.split("\n").map((x) => x.trim()).filter(Boolean);

  const bad = /(ingredients|nutrition|expiry|exp|best before|use by|mrp|price|barcode|manufactured)/i;

  const candidates = lines
    .slice(0, 25)
    .filter((l) => l.length >= 3 && l.length <= 60)
    .filter((l) => /[a-zA-Z]/.test(l))
    .filter((l) => !bad.test(l));

  if (!candidates.length) return "";
  candidates.sort(
    (a, b) =>
      b.replace(/[^A-Za-z]/g, "").length - a.replace(/[^A-Za-z]/g, "").length
  );
  return candidates[0].trim();
}

// POST /api/products/ocr (multipart: front, back; optional body.lang)
export const extractProductFromImagesTesseract = async (req, res) => {
  try {
    const front = req.files?.front?.[0];
    const back = req.files?.back?.[0];

    if (!front && !back) {
      return res.status(400).json({ message: "Upload front and/or back image" });
    }

    // Optional language (default eng)
    const lang = (req.body?.lang || "eng").toString().trim() || "eng";
    const worker = await getWorker(lang);

    let frontText = "";
    let backText = "";

    if (front?.buffer) {
      const pre = await preprocess(front.buffer);
      const { data } = await worker.recognize(pre);
      frontText = cleanText(data?.text || "");
    }

    if (back?.buffer) {
      const pre = await preprocess(back.buffer);
      const { data } = await worker.recognize(pre);
      backText = cleanText(data?.text || "");
    }

    const mergedText = `${frontText}\n\n${backText}`.trim();

    const expiryDateISO = parseExpiryISO(mergedText);
    const priceNumber = parsePrice(mergedText);
    const { quantityNumber, quantityUnit } = parseQuantity(mergedText);
    const name = guessName(frontText, backText);
    const category = guessCategory(mergedText);

    return res.json({
      success: true,
      name,
      priceNumber,
      quantityNumber,
      quantityUnit,
      expiryDateISO,
      category,
      rawText: mergedText,
    });
  } catch (err) {
    console.error("Tesseract OCR error:", err);
    return res.status(500).json({ message: "Failed to OCR product images" });
  }
};