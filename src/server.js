import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cron from "node-cron";

import connectDB from "./config/db.js";
import Product from "./models/Product.js";
import Notification from "./models/Notification.js";
import sendEmail from "./utils/sendEmail.js";
import { stripeWebhook } from "./controllers/paymentController.js";
import { startOfLocalDay } from "./utils/dates.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

import { prewarmOcr } from "./controllers/ocrController.js";

dotenv.config();

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// DB
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}
connectDB();

// CORS
const normalizeOrigin = (o) => String(o || "").trim().replace(/\/+$/, "");
const parseOrigins = (s) =>
  String(s || "")
    .split(",")
    .map((x) => normalizeOrigin(x))
    .filter(Boolean);

const configuredOrigins = parseOrigins(process.env.CLIENT_URLS || process.env.CLIENT_URL);
const allowedOrigins = new Set([...configuredOrigins, "http://localhost:5173"].filter(Boolean));

console.log("🌐 Allowed CORS origins:", Array.from(allowedOrigins));

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const o = normalizeOrigin(origin);
    if (configuredOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.has(o)) return cb(null, true);
    return cb(null, false);
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.options("/api/products/ocr", cors(corsOptions));

// Stripe webhook raw
app.post("/api/payment/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
app.get("/", (req, res) => res.send("🍏 Food Expiry Tracker API Running"));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    allowedOrigins: configuredOrigins,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/payment", paymentRoutes);

// Cron
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("📬 Running daily expiry job:", new Date().toISOString());
    const today = startOfLocalDay();

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    const products = await Product.find({
      expiryDate: { $gte: today, $lte: sevenDaysLater },
    }).populate("user", "email name");

    for (const p of products) {
      if (!p.user?.email) continue;

      try {
        const subject = `⏰ Expiry Alert: ${p.name} expires soon`;
        const text = `Hi ${p.user.name || "there"},\n\nYour product “${p.name}” will expire on ${p.expiryDate.toDateString()}.\nPlease use it before then to avoid waste!\n\n— ReminEx Team`;

        await sendEmail(p.user.email, subject, text);

        await Notification.create({
          user: p.user._id,
          type: "expiry",
          title: "Expiry Alert",
          message: `“${p.name}” will expire on ${p.expiryDate.toDateString()}.`,
          meta: { productId: p._id, expiryDate: p.expiryDate },
        });
      } catch (e) {
        console.error("❌ Failed to send email/notification:", e?.message || e);
      }
    }
  } catch (err) {
    console.error("💥 Cron job error:", err?.message || err);
  }
});

// 404
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err);

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 5MB)" });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload too large (Max 50MB)" });
  }

  return res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📅 Daily cron job scheduled at midnight");

  prewarmOcr(["eng"])
    .then(() => console.log("✅ OCR prewarmed (eng)"))
    .catch((e) => console.warn("⚠️ OCR prewarm failed:", e?.message || e));
});