import sharp from "sharp";
import { createWorker } from "tesseract.js";
import os from "os";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Cache workers per language so we don't re-initialize every request.
 * lang examples: "eng", "eng+tam"
 */
const workerCache = new Map();

/**
 * Serialize OCR per language to avoid CPU/RAM spikes (prevents 502 on small servers)
 */
const langLocks = new Map();
const withLangLock = async (langKey, fn) => {
  const prev = langLocks.get(langKey) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  langLocks.set(langKey, run.catch(() => {}));
  return run;
};

/**
 * ✅ tesseract.js v7: createWorker(langs, oem, options)
 * Passing options object as first param can crash with:
 * "langsArr.map is not a function"
 */
async function getWorker(lang = "eng") {
  const key = (lang || "eng").toString().trim() || "eng";
  if (workerCache.has(key)) return workerCache.get(key);

  const p = (async () => {
    const cachePath = path.join(os.tmpdir(), "tesseract-cache");

    // ✅ correct signature for v7
    const worker = await createWorker(key, 1, {
      cachePath,
      // DO NOT pass logger: () => {} (functions cannot be cloned to worker threads)
    });

    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/.-,:₹$€£()% ",
    });

    return worker;
  })();

  p.catch(() => workerCache.delete(key));
  workerCache.set(key, p);
  return p;
}

export const prewarmOcr = async (langs = ["eng"]) => {
  for (const l of langs) await getWorker(l);
};

// Reduce sharp memory on small servers
sharp.cache(false);
sharp.concurrency(1);

async function preprocess(buffer) {
  // If still slow/unreliable on Render, lower width to 1000 and remove normalize/threshold.
  return sharp(buffer)
    .rotate()
    .resize({ width: 1300, withoutEnlargement: true })
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

  let m = scope.match(/\b(20\d{2})[-\/\.](\d{1,2})[-\/\.](\d{1,2})\b/);
  if (m) {
    const y = Number(m[1]);
    const mo = String(Number(m[2])).padStart(2, "0");
    const d = String(Number(m[3])).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

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

  const currency = [
    ...t.matchAll(/(?:₹|rs\.?|lkr|usd|\$|€|£)\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi),
  ]
    .map((m) => parseNumber(m[1]))
    .filter((n) => n != null);

  const keyword = [
    ...t.matchAll(/\b(?:mrp|price|amount)\s*[:\-]?\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi),
  ]
    .map((m) => parseNumber(m[1]))
    .filter((n) => n != null);

  const slashDash = [
    ...t.matchAll(/\b([0-9][0-9,]*\.?[0-9]{0,2})\s*\/-\b/g),
  ]
    .map((m) => parseNumber(m[1]))
    .filter((n) => n != null);

  const all = [...currency, ...keyword, ...slashDash].filter((n) => n > 0 && n < 100000);
  if (!all.length) return null;
  return Math.max(...all);
}

function parseQuantity(text) {
  const t = String(text || "");
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

  const bad =
    /(ingredients|nutrition|expiry|exp|best before|use by|mrp|price|barcode|manufactured)/i;

  const candidates = lines
    .slice(0, 25)
    .filter((l) => l.length >= 3 && l.length <= 60)
    .filter((l) => /[a-zA-Z]/.test(l))
    .filter((l) => !bad.test(l));

  if (!candidates.length) return "";
  candidates.sort((a, b) => b.replace(/[^A-Za-z]/g, "").length - a.replace(/[^A-Za-z]/g, "").length);
  return candidates[0].trim();
}

// POST /api/products/ocr (multipart: front, back; optional body.lang)
export const extractProductFromImagesTesseract = async (req, res) => {
  try {
    if (isDev) {
      console.log("OCR files keys:", Object.keys(req.files || {}));
      console.log("OCR front?", !!req.files?.front?.[0], "back?", !!req.files?.back?.[0]);
    }

    const front = req.files?.front?.[0];
    const back = req.files?.back?.[0];

    if (!front && !back) {
      return res.status(400).json({ message: "Upload front and/or back image" });
    }

    const lang = (req.body?.lang || "eng").toString().trim() || "eng";
    const worker = await getWorker(lang);

    const result = await withLangLock(lang, async () => {
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

      return {
        success: true,
        name: guessName(frontText, backText),
        priceNumber: parsePrice(mergedText),
        ...parseQuantity(mergedText),
        expiryDateISO: parseExpiryISO(mergedText),
        category: guessCategory(mergedText),
        rawText: mergedText,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("Tesseract OCR error:", err?.message || err);
    return res.status(500).json({ message: "Failed to OCR product images" });
  }
};