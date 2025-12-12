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

export const updateUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;
    let avatarPath = user.avatar;

    if (req.file?.buffer) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, "reminex/avatars");
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