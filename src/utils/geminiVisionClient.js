// backend/src/utils/geminiVisionClient.js
import axios from "axios";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

// v1 is usually the better default if your key supports it
const PRIMARY_API_VERSION = (process.env.GEMINI_API_VERSION || "v1").trim();

// If set, we will only use it if it exists in ListModels for your key/version
const RAW_MODEL = (process.env.GEMINI_MODEL || "").trim();
const ENV_MODEL = RAW_MODEL ? RAW_MODEL.replace(/^models\//, "") : "";

const redactKey = (url) => url.replace(/key=[^&]+/i, "key=***");

const buildUrl = (apiVersion, model) =>
  `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

const listUrl = (apiVersion) =>
  `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${GEMINI_API_KEY}`;

// Cache model lists
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
const modelCache = {
  v1: { at: 0, models: [] },
  v1beta: { at: 0, models: [] },
};

// Cache “bad models” (404) so we stop retrying them constantly
const BAD_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const badModelCache = {
  v1: new Map(), // model -> timestamp
  v1beta: new Map(),
};

const markBad = (apiVersion, model) => {
  badModelCache[apiVersion]?.set(model, Date.now());
};

const isBad = (apiVersion, model) => {
  const t = badModelCache[apiVersion]?.get(model);
  if (!t) return false;
  if (Date.now() - t > BAD_CACHE_TTL_MS) {
    badModelCache[apiVersion].delete(model);
    return false;
  }
  return true;
};

const preferSort = (names) => {
  // Put flash models first for speed
  const score = (m) => {
    const s = m.toLowerCase();
    if (s.includes("flash")) return 0;
    if (s.includes("pro")) return 1;
    return 2;
  };
  return [...names].sort((a, b) => score(a) - score(b));
};

const getModels = async (apiVersion) => {
  const now = Date.now();
  const cached = modelCache[apiVersion];
  if (cached?.models?.length && now - cached.at < MODEL_CACHE_TTL_MS) {
    return cached.models;
  }

  const url = listUrl(apiVersion);
  const res = await axios.get(url, { timeout: 20000 });

  const models = Array.isArray(res.data?.models) ? res.data.models : [];

  const names = models
    .filter(
      (m) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes("generateContent")
    )
    .map((m) => (m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

  const sorted = preferSort(names);

  modelCache[apiVersion] = { at: now, models: sorted };
  return sorted;
};

const isLikelyVisionNotSupported = (msg = "") => {
  const m = msg.toLowerCase();
  return (
    m.includes("inline data") ||
    m.includes("inlinedata") ||
    (m.includes("image") && m.includes("not supported")) ||
    m.includes("invalid argument")
  );
};

export const analyzeImageWithGemini = async (
  base64Image,
  mimeType = "image/jpeg"
) => {
  if (!GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY not configured in .env");
  }

  const prompt = `Return ONLY valid JSON (no markdown, no extra text):
{"condition":"fresh","days":5,"notes":"Brief observation"}

Rules:
- fresh → 5–7 days
- slightly damaged → 2–3 days
- rotting → 0 days
Be conservative for food safety.`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 250 },
  };

  const versionsToTry = [
    PRIMARY_API_VERSION,
    PRIMARY_API_VERSION === "v1" ? "v1beta" : "v1",
  ];

  let lastErr;

  for (const apiVersion of versionsToTry) {
    let listed = [];
    try {
      listed = await getModels(apiVersion);
    } catch (e) {
      console.error("❌ ListModels failed:", {
        apiVersion,
        status: e.response?.status,
        message: e.response?.data?.error?.message || e.message,
        url: redactKey(listUrl(apiVersion)),
      });
      // If ListModels fails, we can only try ENV_MODEL (if provided)
      listed = [];
    }

    // Build candidates:
    // If ENV_MODEL exists, only try it if it is in the listed models
    // (prevents repeated 404 spam from invalid env values)
    let candidates = [];

    if (ENV_MODEL) {
      if (listed.length === 0) {
        // ListModels failed: last resort try env model
        candidates.push(ENV_MODEL);
      } else if (listed.includes(ENV_MODEL)) {
        candidates.push(ENV_MODEL);
      } else {
        console.warn(
          `⚠️ GEMINI_MODEL=${ENV_MODEL} not found in ListModels for ${apiVersion}. Skipping it.`
        );
      }
    }

    // Add listed models after env model, de-dup
    for (const m of listed) {
      if (!candidates.includes(m)) candidates.push(m);
    }

    // Filter out known bad models
    candidates = candidates.filter((m) => !isBad(apiVersion, m));

    // Try first few models only
    const MAX_TRIES = 6;
    candidates = candidates.slice(0, MAX_TRIES);

    if (!candidates.length) continue;

    for (const model of candidates) {
      const url = buildUrl(apiVersion, model);

      try {
        console.log(`🤖 Calling Gemini: version=${apiVersion} model=${model}`);

        const response = await axios.post(url, body, {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response text from Gemini API");
        return String(text).trim();
      } catch (err) {
        lastErr = err;

        const status = err.response?.status;
        const message = err.response?.data?.error?.message || err.message;

        console.error("❌ Gemini error:", {
          apiVersion,
          model,
          status,
          message,
          url: redactKey(url),
        });

        if (status === 404) {
          // model not available: mark bad and continue
          markBad(apiVersion, model);
          continue;
        }

        if (status === 400 && isLikelyVisionNotSupported(message)) {
          // model exists but likely doesn't support inlineData image; continue
          continue;
        }

        // anything else: stop
        throw err;
      }
    }
  }

  throw lastErr || new Error("Gemini call failed (no working model found).");
};