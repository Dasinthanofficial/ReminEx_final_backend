import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cron from "node-cron";

import connectDB from "./config/db.js";
import Product from "./models/Product.js";
import sendEmail from "./utils/sendEmail.js";
import { stripeWebhook } from "./controllers/paymentController.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// --------------------------------------------------
// Initialisation
// --------------------------------------------------

dotenv.config();
connectDB();

const app = express();
app.disable("x-powered-by");

// ESModule path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Created uploads directory:", uploadsDir);
}

// --------------------------------------------------
// Middleware
// --------------------------------------------------

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Stripe webhook MUST be raw and BEFORE express.json
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Body parsers (for all other routes)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Static file hosting for uploads
app.use("/uploads", express.static(uploadsDir));

// --------------------------------------------------
// Routes
// --------------------------------------------------

app.get("/", (req, res) => {
  res.send("Food Expiry Tracker API Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/payment", paymentRoutes); // checkout/verify/cancel only

// --------------------------------------------------
// Cron: daily expiry email job
// --------------------------------------------------
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("📬 Running daily expiry job:", new Date().toISOString());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    const products = await Product.find({
      expiryDate: { $gte: today, $lte: sevenDaysLater },
    }).populate("user", "email name");

    let success = 0;
    let fail = 0;

    for (const p of products) {
      if (!p.user?.email) continue;

      try {
        const subject = `⏰ Expiry Alert: ${p.name} expires soon`;
        const text = `Hi ${
          p.user.name || "there"
        },\n\nYour product "${p.name}" will expire on ${p.expiryDate.toDateString()}.\n\nPlease use it before it expires to avoid waste!\n\n— Food Expiry Tracker Team`;

        await sendEmail(p.user.email, subject, text);
        success++;
      } catch (emailErr) {
        console.error(
          `❌ Failed to send email to ${p.user.email}:`,
          emailErr.message
        );
        fail++;
      }
    }

    console.log(
      `✅ Email job: ${success} sent, ${fail} failed of ${products.length}`
    );
  } catch (err) {
    console.error("❌ Cron job error:", err);
  }
});

// --------------------------------------------------
// Error Handling
// --------------------------------------------------

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err);

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large (max 5 MB)" });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload too large (Max 50MB)" });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📅 Daily cron job scheduled at midnight");
});

