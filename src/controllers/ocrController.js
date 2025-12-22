import sharp from "sharp";
import { createWorker } from "tesseract.js";
import os from "os";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Cache workers per language so we don't re-initialize every request.
 * Example langs: "eng", "eng+tam"
 */
const workerCache = new Map();

/**
 * Serialize OCR per language to avoid CPU/RAM spikes (prevents 502 on small instances)
 */
const langLocks = new Map();
const withLangLock = async (langKey, fn) => {
  const prev = langLocks.get(langKey) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  langLocks.set(langKey, run.catch(() => {}));
  return run;
};

// Sharp memory tuning (important on Render)
sharp.cache(false);
sharp.concurrency(1);

/**
 * FAST preprocess: quick + usually good enough
 */
async function preprocessFast(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1100, withoutEnlargement: true })
    .grayscale()
    .sharpen()
    .toBuffer();
}

/**
 * QUALITY preprocess: heavier, better on low-contrast/noisy labels
 */
async function preprocessQuality(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .median(1) // tiny denoise
    .sharpen()
    .threshold(180)
    .toBuffer();
}

/**
 * ✅ tesseract.js v7: createWorker(langs, oem, options)
 * Do NOT pass logger functions; do NOT pass options as first param.
 */
async function getWorker(lang = "eng") {
  const key = (lang || "eng").toString().trim() || "eng";
  if (workerCache.has(key)) return workerCache.get(key);

  const p = (async () => {
    const cachePath = path.join(os.tmpdir(), "tesseract-cache");

    // OEM 1 = LSTM (good accuracy)
    const worker = await createWorker(key, 1, { cachePath });

    await worker.setParameters({
      // whitelist helps avoid random garbage chars
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/.-,:₹$€£()% ",
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    return worker;
  })();

  // If init fails once, let future requests retry
  p.catch(() => workerCache.delete(key));

  workerCache.set(key, p);
  return p;
}

/**
 * Optional warm-up to avoid slow first request
 */
export const prewarmOcr = async (langs = ["eng"]) => {
  for (const l of langs) await getWorker(l);
};

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

async function recognizeTwoPass(worker, buffer, { fastPsm = "6", qualityPsm = "3" } = {}) {
  // FAST pass params
  await worker.setParameters({
    tessedit_pageseg_mode: fastPsm, // 6 = uniform block
    load_system_dawg: "0",
    load_freq_dawg: "0",
  });

  const fastPre = await preprocessFast(buffer);
  const fast = await worker.recognize(fastPre);
  const fastText = cleanText(fast?.data?.text || "");
  const fastConf = Number(fast?.data?.confidence ?? 0);

  // If fast looks good, stop early
  const fastHasExpiry = !!parseExpiryISO(fastText);
  const fastHasPrice = parsePrice(fastText) != null;

  if (fastConf >= 75 && (fastHasExpiry || fastHasPrice)) {
    return { text: fastText, confidence: fastConf, mode: "fast" };
  }

  // QUALITY pass params
  await worker.setParameters({
    tessedit_pageseg_mode: qualityPsm, // 3 = fully automatic page segmentation
    load_system_dawg: "1",
    load_freq_dawg: "1",
  });

  const qPre = await preprocessQuality(buffer);
  const q = await worker.recognize(qPre);
  const qText = cleanText(q?.data?.text || "");
  const qConf = Number(q?.data?.confidence ?? 0);

  // Choose best by confidence, but prefer whichever yields key fields
  const qHasExpiry = !!parseExpiryISO(qText);
  const qHasPrice = parsePrice(qText) != null;

  const chooseQuality =
    (qHasExpiry && !fastHasExpiry) ||
    (qHasPrice && !fastHasPrice) ||
    qConf >= fastConf + 5;

  return chooseQuality
    ? { text: qText, confidence: qConf, mode: "quality" }
    : { text: fastText, confidence: fastConf, mode: "fast" };
}

// POST /api/products/ocr (multipart: front, back; optional body.lang)
export const extractProductFromImagesTesseract = async (req, res) => {
  try {
    const front = req.files?.front?.[0];
    const back = req.files?.back?.[0];

    if (!front && !back) {
      return res.status(400).json({ message: "Upload front and/or back image" });
    }

    const lang = (req.body?.lang || "eng").toString().trim() || "eng";
    const worker = await getWorker(lang);

    const out = await withLangLock(lang, async () => {
      // OCR front first, back only if needed (speed)
      let frontText = "";
      let backText = "";
      let frontMeta = null;
      let backMeta = null;

      if (front?.buffer) {
        const r = await recognizeTwoPass(worker, front.buffer);
        frontText = r.text;
        frontMeta = { confidence: r.confidence, mode: r.mode };
      }

      // Decide if we need back
      const nameGuess = guessName(frontText, "");
      const expiryFront = parseExpiryISO(frontText);
      const priceFront = parsePrice(frontText);

      const needBack =
        !nameGuess || !expiryFront || priceFront == null;

      if (needBack && back?.buffer) {
        const r = await recognizeTwoPass(worker, back.buffer);
        backText = r.text;
        backMeta = { confidence: r.confidence, mode: r.mode };
      }

      const mergedText = `${frontText}\n\n${backText}`.trim();

      const expiryDateISO = parseExpiryISO(mergedText);
      const priceNumber = parsePrice(mergedText);
      const { quantityNumber, quantityUnit } = parseQuantity(mergedText);
      const name = guessName(frontText, backText);
      const category = guessCategory(mergedText);

      return {
        success: true,
        name,
        priceNumber,
        quantityNumber,
        quantityUnit,
        expiryDateISO,
        category,
        rawText: mergedText,
        ...(isDev
          ? {
              debug: {
                lang,
                front: frontMeta,
                back: backMeta,
              },
            }
          : {}),
      };
    });

    return res.json(out);
  } catch (err) {
    console.error("Tesseract OCR error:", err?.message || err);
    return res.status(500).json({ message: "Failed to OCR product images" });
  }
};