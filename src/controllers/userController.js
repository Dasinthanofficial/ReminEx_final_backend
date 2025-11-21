import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

/**
 * GET /api/user/dashboard
 * Fetch user details and recent products
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
      role: user.role, // ✅ Include role to fix Admin refresh redirect issues
      avatar: user.avatar || "/uploads/default_avatar.png",
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
 * Calculates waste for a given month ONLY if the item has actually expired.
 */
export const getUserMonthlyReport = async (req, res) => {
  try {
    // 1. Check Premium Access
    if (!["Monthly", "Yearly"].includes(req.user.plan)) {
      return res
        .status(403)
        .json({ message: "Premium required to access detailed reports" });
    }

    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    
    // Calculate Start and End of the selected month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // 2. Aggregate Query
    const agg = await Product.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user._id),
          $and: [
            { expiryDate: { $gte: start, $lte: end } }, // Condition 1: Expiry falls in this month
            { expiryDate: { $lt: now } }                // Condition 2: Date must be in the past (Expired)
          ]
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
 * Update user name and/or avatar upload
 */
export const updateUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;
    let avatarPath = user.avatar;

    /* 1️⃣ Handle new uploaded file */
    if (req.file) {
      // Multer stores the file in /uploads/
      const filename = req.file.filename;
      avatarPath = `/uploads/${filename}`;

      // Delete old avatar if it’s a local upload (and not default)
      if (
        user.avatar && 
        user.avatar.includes("/uploads/") && 
        !user.avatar.includes("default")
      ) {
        const oldFile = user.avatar.split("/uploads/")[1];
        const oldPath = path.join(process.cwd(), "uploads", oldFile);
        
        // Use async unlink with callback to prevent crashing if file missing
        fs.unlink(oldPath, (err) => {
          if (err) console.log("Note: Could not delete old avatar:", err.message);
        });
      }
    } else if (req.body.avatar && req.body.avatar.startsWith("http")) {
      // Optional: allow setting an external URL directly
      avatarPath = req.body.avatar;
    }

    /* 2️⃣ Update fields */
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