import express from "express";
import dotenv from "dotenv";
import path from "path";            // ✅ only once
import { fileURLToPath } from "url"; // ✅ only once
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cron from "node-cron";
import Product from "./models/Product.js";
import User from "./models/User.js";
import sendEmail from "./utils/sendEmail.js";
import planRoutes from "./routes/planRoutes.js";
import advertisementRoutes from "./routes/advertisementRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";


dotenv.config();
connectDB();

const app = express();
app.use(express.json());

// __dirname setup for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plans", planRoutes);
app.get("/", (req, res) => res.send("Food Expiry Tracker API"));
app.use("/api/advertisements", advertisementRoutes);
app.use("/api/payment", paymentRoutes);


// DAILY CRON: 7-day expiry notification
cron.schedule("5 0 * * *", async () => {
  try {
    console.log("Running daily expiry notification job");
    const target = new Date();
    target.setDate(target.getDate() + 7);
    target.setHours(0,0,0,0);

    const start = new Date(target);
    const end = new Date(target);
    end.setHours(23,59,59,999);

    const products = await Product.find({ expiryDate: { $gte: start, $lte: end } })
      .populate("user", "email name");

    for (const p of products) {
      if (!p.user || !p.user.email) continue;
      const subject = `Expiry reminder: ${p.name} expires in 7 days`;
      const text = `Hi ${p.user.name || ""},\n\nYour product "${p.name}" will expire on ${p.expiryDate.toDateString()}. Please use it before it expires.\n\nThanks,\nFood Expiry Tracker`;
      await sendEmail(p.user.email, subject, text);
    }

    console.log(`Notified ${products.length} products/users`);
  } catch (err) {
    console.error("Cron job error:", err);
  }
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
