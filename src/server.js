import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import cron from "node-cron";

import connectDB from "./config/db.js";
import Product from "./models/Product.js";
import sendEmail from "./utils/sendEmail.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// 1️⃣ Load environment variables first
dotenv.config();
connectDB();

const app = express();

// 2️⃣ Path utilities for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3️⃣ Ensure "uploads" directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 4️⃣ Stripe Webhook – must be BEFORE express.json()
app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" })
);

// 5️⃣ Global Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ JSON parser for all other routes (keep AFTER webhook)
app.use(express.json());

// ✅ Static files
app.use("/uploads", express.static(uploadsDir));

// 6️⃣ API Routes
app.get("/", (req, res) => res.send("Food Expiry Tracker API Running"));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);

app.use("/api/payment", paymentRoutes);

// 7️⃣ CRON – Daily 7-day expiry notifications - ✅ FIXED: Better error handling
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("📬 Running daily expiry job:", new Date().toISOString());

    const target = new Date();
    target.setDate(target.getDate() + 7);
    target.setHours(0, 0, 0, 0);

    const start = new Date(target);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const products = await Product.find({
      expiryDate: { $gte: start, $lte: end },
    }).populate("user", "email name");

    let successCount = 0;
    let failCount = 0;

    for (const p of products) {
      if (!p.user?.email) {
        console.log(`⚠️ Skipping product ${p.name} - no user email`);
        continue;
      }

      try {
        const subject = `⏰ Expiry Alert: ${p.name} expires in 7 days`;
        const text = `Hi ${p.user.name || "there"},\n\nYour product "${p.name}" will expire on ${p.expiryDate.toDateString()}.\n\nPlease use it before it expires to avoid waste!\n\n— Food Expiry Tracker Team`;

        await sendEmail(p.user.email, subject, text);
        console.log(`📧 Sent reminder to ${p.user.email} for ${p.name}`);
        successCount++;
      } catch (emailErr) {
        console.error(`❌ Failed to send email to ${p.user.email}:`, emailErr.message);
        failCount++;
      }
    }

    console.log(`✅ Email job complete: ${successCount} sent, ${failCount} failed out of ${products.length} total`);
  } catch (err) {
    console.error("❌ Cron job error:", err);
  }
});

// 8️⃣ 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// 9️⃣ Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err);

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 5 MB)" });
    }
    return res.status(400).json({ message: err.message });
  }


  if (req.originalUrl === "/api/payment/webhook") {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📅 Daily cron job scheduled at 00:00 (midnight)");
});