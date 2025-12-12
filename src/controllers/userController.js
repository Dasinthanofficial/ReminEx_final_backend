import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";

/**
 * Helper: upload a buffer to Cloudinary
 */
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

/**
 * GET /api/user/dashboard
 */
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
      avatar: user.avatar, // default comes from schema (Cloudinary URL)
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

/**
 * GET /api/user/reports?month=&year=
 * Premium users only
 * Counts items as wasted only if expiry date is BEFORE today (calendar day).
 */
export const getUserMonthlyReport = async (req, res) => {
  try {
    if (!["Monthly", "Yearly"].includes(req.user.plan)) {
      return res
        .status(403)
        .json({ message: "Premium required to access detailed reports" });
    }

    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // Start of today (local calendar day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agg = await Product.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user._id),
          expiryDate: {
            $gte: start,
            $lte: end,
            $lt: today, // 👈 only dates BEFORE today are counted as wasted
          },
        },
      },
      {
        $group: {
          _id: null,
          totalWaste: { $sum: "$price" },
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

/**
 * PUT /api/user/profile
 * - Updates name and avatar
 * - Avatar uploaded to Cloudinary if file is provided
 */
export const updateUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;
    let avatarPath = user.avatar;

    if (req.file && req.file.buffer) {
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        "reminex/avatars"
      );
      avatarPath = uploadResult.secure_url;
    } else if (req.body.avatar && req.body.avatar.startsWith("http")) {
      // Allow setting avatar to another remote URL (e.g., Google profile picture)
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