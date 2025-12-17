import Product from "../models/Product.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import { startOfLocalDay, monthRangeLocal } from "../utils/dates.js";

/**
 * Helper: upload a buffer to Cloudinary
 */
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
};

// 🟢 Dashboard
export const getUserDashboard = async (req, res) => {
  try {
    const user = req.user;
    const recent = await Product.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      plan: user.plan,
      planExpiry: user.planExpiry,
      productCount: user.productCount,
      recentProducts: recent,
    });
  } catch (err) {
    console.error("Error fetching dashboard:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🟢 Monthly report (premium only)
export const getUserMonthlyReport = async (req, res) => {
  try {
    if (!["Monthly", "Yearly"].includes(req.user.plan)) {
      return res.status(403).json({
        message: "Premium required to access detailed reports",
      });
    }

    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    const { start, end } = monthRangeLocal(year, month);
    const today = startOfLocalDay();

    const agg = await Product.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user._id),
          expiryDate: { $gte: start, $lte: end, $lt: today },
        },
      },
      {
        $group: {
          _id: null,
          totalWaste: { $sum: { $ifNull: ["$price", 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalWaste = agg[0]?.totalWaste || 0;
    const count = agg[0]?.count || 0;

    res.json({ month, year, totalWaste, wastedCount: count });
  } catch (err) {
    console.error("Error calculating report:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🟢 Profile update
export const updateUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;
    let avatarPath = user.avatar;

    if (req.file?.buffer) {
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        "reminex/avatars"
      );
      avatarPath = uploadResult.secure_url;
    } else if (req.body.avatar && req.body.avatar.startsWith("http")) {
      avatarPath = req.body.avatar;
    }

    if (name) user.name = name;
    user.avatar = avatarPath;

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        plan: user.plan,
        planExpiry: user.planExpiry,
        productCount: user.productCount,
      },
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢 Notifications for user dashboard bell
 * Computed dynamically: FOOD items expiring within the next 7 days,
 * with kind, friendly messages.
 */
export const getUserNotifications = async (req, res) => {
  try {
    const today = startOfLocalDay();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // Only FOOD items for this user expiring within 7 days
    const products = await Product.find({
      user: req.user._id,
      category: "Food",
      expiryDate: { $gte: today, $lte: sevenDaysLater },
    })
      .sort({ expiryDate: 1 })
      .lean();

    const msPerDay = 1000 * 60 * 60 * 24;

    const notifications = products.map((p) => {
      const exp = new Date(p.expiryDate);
      const expMid = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
      const diffDays = Math.round((expMid - today) / msPerDay);

      let timeLabel;
      if (diffDays === 0) timeLabel = "expires today";
      else if (diffDays === 1) timeLabel = "expires tomorrow";
      else timeLabel = `expires in ${diffDays} days`;

      // Kind, friendly message based on how close it is
      let message;
      if (diffDays === 0) {
        message = `“${p.name}” expires today. Perfect time to enjoy it and avoid waste.`;
      } else if (diffDays === 1) {
        message = `“${p.name}” expires tomorrow. Maybe plan a meal with it tonight or tomorrow.`;
      } else if (diffDays <= 3) {
        message = `“${p.name}” ${timeLabel}. A great moment to use it in a recipe and keep it from going to waste.`;
      } else {
        message = `“${p.name}” ${timeLabel}. Still fresh, but good to keep an eye on it.`;
      }

      return {
        id: String(p._id),
        type: "expiry",
        title: "Expiry Reminder",
        message,
        expiryDate: p.expiryDate,
        createdAt: p.createdAt,
        diffDays, // ✅ added so frontend can group by severity
      };
    });

    // Optional friendly summary at top
    let summary = null;
    if (notifications.length > 0) {
      const count = notifications.length;
      summary = {
        id: "summary",
        type: "summary",
        title: "Items expiring soon",
        message:
          count === 1
            ? "You have 1 item expiring within the next 7 days. Great time to plan a meal around it!"
            : `You have ${count} items expiring within the next 7 days. Using them in time helps reduce waste and save money.`,
        createdAt: new Date(),
      };
    }

    const allNotifications = summary
      ? [summary, ...notifications]
      : notifications;

    res.json({
      notifications: allNotifications,
      count: notifications.length,
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: err.message });
  }
};