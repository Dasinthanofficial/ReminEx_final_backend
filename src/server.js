import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cron from "node-cron";
import Product from "./models/Product.js";
import sendEmail from "./utils/sendEmail.js";
import planRoutes from "./routes/planRoutes.js";
import advertisementRoutes from "./routes/advertisementRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import cors from "cors";

dotenv.config();
connectDB();

const app = express();

// __dirname setup for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ CRITICAL: Webhook route MUST come BEFORE express.json()
// This preserves the raw body for Stripe signature verification
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

// ✅ CORS Configuration - Must come BEFORE routes
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Now apply JSON parser for all OTHER routes
app.use(express.json());

// ✅ Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Routes
app.get("/", (req, res) => res.send("Food Expiry Tracker API"));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/advertisements", advertisementRoutes);
app.use("/api/payment", paymentRoutes);

// ✅ DAILY CRON: 7-day expiry notification
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running daily expiry notification job at", new Date());
    
    const target = new Date();
    target.setDate(target.getDate() + 7);
    target.setHours(0, 0, 0, 0);

    const start = new Date(target);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const products = await Product.find({
      expiryDate: { $gte: start, $lte: end },
    }).populate("user", "email name");

    console.log(`Found ${products.length} products expiring in 7 days`);

    for (const p of products) {
      if (!p.user || !p.user.email) continue;
      
      const subject = `⏰ Expiry Alert: ${p.name} expires in 7 days`;
      const text = `Hi ${p.user.name || "there"},\n\nYour product "${p.name}" will expire on ${p.expiryDate.toDateString()}.\n\nPlease use it before it expires to avoid waste!\n\nBest regards,\nFood Expiry Tracker Team`;
      
      await sendEmail(p.user.email, subject, text);
      console.log(`Sent reminder to ${p.user.email} for ${p.name}`);
    }

    console.log(`✅ Successfully notified ${products.length} users`);
  } catch (err) {
    console.error("❌ Cron job error:", err);
  }
});

// ✅ 404 Handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  
  // Handle Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max 5MB allowed.' });
    }
    return res.status(400).json({ message: err.message });
  }
  
  res.status(err.status || 500).json({ 
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📅 Daily cron job scheduled at 00:00 (midnight)`);
});