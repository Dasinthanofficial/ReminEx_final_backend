// // backend/src/server.js
// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import cron from "node-cron";

// import connectDB from "./config/db.js";
// import Product from "./models/Product.js";
// import Notification from "./models/Notification.js"; // 🟢 NEW
// import sendEmail from "./utils/sendEmail.js";
// import { stripeWebhook } from "./controllers/paymentController.js";
// import { startOfLocalDay } from "./utils/dates.js";

// import authRoutes from "./routes/authRoutes.js";
// import productRoutes from "./routes/productRoutes.js";
// import userRoutes from "./routes/userRoutes.js";
// import adminRoutes from "./routes/adminRoutes.js";
// import planRoutes from "./routes/planRoutes.js";
// import paymentRoutes from "./routes/paymentRoutes.js";

// // ------------------------------------------------------------------
// // 1️⃣  INITIALIZATION
// // ------------------------------------------------------------------
// dotenv.config();

// if (!process.env.MONGO_URI) {
//   console.error("❌  MONGO_URI missing in .env");
//   process.exit(1);
// }
// connectDB();

// const app = express();
// app.disable("x-powered-by");

// // ------------------------------------------------------------------
// // 2️⃣  GLOBAL MIDDLEWARE
// // ------------------------------------------------------------------
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || "http://localhost:5173",
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// // Stripe webhook MUST be raw (before body parsers)
// app.post(
//   "/api/payment/webhook",
//   express.raw({ type: "application/json" }),
//   stripeWebhook
// );

// // Body parsers for all other routes
// app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ limit: "50mb", extended: true }));

// // ------------------------------------------------------------------
// // 3️⃣  ROUTES
// // ------------------------------------------------------------------
// app.get("/", (req, res) => {
//   res.send("🍏 Food Expiry Tracker API Running");
// });

// app.use("/api/auth", authRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/user", userRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/plans", planRoutes);
// app.use("/api/payment", paymentRoutes);

// // ------------------------------------------------------------------
// // 4️⃣  DAILY CRON JOB – expiry reminder emails + notifications
// // ------------------------------------------------------------------
// cron.schedule("0 0 * * *", async () => {
//   try {
//     console.log("📬  Running daily expiry job:", new Date().toISOString());
//     const today = startOfLocalDay();

//     const sevenDaysLater = new Date(today);
//     sevenDaysLater.setDate(today.getDate() + 7);
//     sevenDaysLater.setHours(23, 59, 59, 999);

//     const products = await Product.find({
//       expiryDate: { $gte: today, $lte: sevenDaysLater },
//     }).populate("user", "email name");

//     let sent = 0;
//     let failed = 0;

//     for (const p of products) {
//       if (!p.user?.email) continue;

//       try {
//         const subject = `⏰ Expiry Alert: ${p.name} expires soon`;
//         const text = `Hi ${p.user.name || "there"},\n\nYour product “${p.name}” will expire on ${p.expiryDate.toDateString()}.\nPlease use it before then to avoid waste!\n\n— Food Expiry Tracker Team`;

//         await sendEmail(p.user.email, subject, text);
//         sent++;

//         // 🟢 Also create in-app notification
//         await Notification.create({
//           user: p.user._id,
//           type: "expiry",
//           title: "Expiry Alert",
//           message: `“${p.name}” will expire on ${p.expiryDate.toDateString()}.`,
//           meta: {
//             productId: p._id,
//             expiryDate: p.expiryDate,
//           },
//         });
//       } catch (e) {
//         console.error(`❌ Failed to send → ${p.user.email}:`, e.message);
//         failed++;
//       }
//     }

//     console.log(
//       `✅ Expiry email job done → ${sent} sent, ${failed} failed out of ${products.length}`
//     );
//   } catch (err) {
//     console.error("💥 Cron job error:", err);
//   }
// });

// // ------------------------------------------------------------------
// // 5️⃣  ERROR HANDLING
// // ------------------------------------------------------------------

// // 404 – unknown route
// app.use((req, res) => {
//   res.status(404).json({ message: "Route not found" });
// });

// // general / upload size / Multer errors
// app.use((err, req, res, next) => {
//   console.error("💥 Server Error:", err);

//   if (err.name === "MulterError") {
//     if (err.code === "LIMIT_FILE_SIZE") {
//       return res.status(400).json({ message: "File too large (max 5 MB)" });
//     }
//     return res.status(400).json({ message: err.message });
//   }

//   if (err.type === "entity.too.large") {
//     return res.status(413).json({ message: "Payload too large (Max 50 MB)" });
//   }

//   return res.status(err.status || 500).json({
//     message: err.message || "Internal Server Error",
//   });
// });

// // ------------------------------------------------------------------
// // 6️⃣  START SERVER
// // ------------------------------------------------------------------
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀  Server running on port ${PORT}`);
//   console.log("📅 Daily cron job scheduled at midnight");
// });


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

// ✅ NEW: prewarm OCR
import { prewarmOcr } from "./controllers/ocrController.js";

dotenv.config();

// Helpful crash logs (Render 502 often = process crash/restart)
process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// ----------------------------
// DB
// ----------------------------
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}
connectDB();

// ----------------------------
// CORS (Vercel + Localhost)
// ----------------------------
const normalizeOrigin = (o) => String(o || "").trim().replace(/\/+$/, "");

const parseOrigins = (s) =>
  String(s || "")
    .split(",")
    .map((x) => normalizeOrigin(x))
    .filter(Boolean);

const configuredOrigins = parseOrigins(process.env.CLIENT_URLS || process.env.CLIENT_URL);

// Always allow local dev too
const allowedOrigins = new Set(
  [...configuredOrigins, "http://localhost:5173"].filter(Boolean)
);

console.log("🌐 Allowed CORS origins:", Array.from(allowedOrigins));

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman

    const o = normalizeOrigin(origin);

    // If env not set, allow all (dev-friendly)
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

// ✅ Optional explicit preflight for OCR route
app.options("/api/products/ocr", cors(corsOptions));

// ----------------------------
// Stripe webhook MUST be raw
// ----------------------------
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ----------------------------
// Routes
// ----------------------------
app.get("/", (req, res) => {
  res.send("🍏 Food Expiry Tracker API Running");
});

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

// ----------------------------
// Cron job
// ----------------------------
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

// ----------------------------
// Error handling
// ----------------------------
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

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

// ----------------------------
// Start server
// ----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📅 Daily cron job scheduled at midnight");

  // ✅ Prewarm OCR after server is listening (helps prevent first-request 502)
  prewarmOcr(["eng"])
    .then(() => console.log("✅ OCR prewarmed (eng)"))
    .catch((e) => console.warn("⚠️ OCR prewarm failed:", e?.message || e));
});