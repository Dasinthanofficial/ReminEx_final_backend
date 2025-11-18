import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import fs from "fs"; // ⚠️ Required for deleting old profile images

/**
 * GET /api/user/dashboard
 * Fetch user details and recent products.
 */
export const getUserDashboard = async (req, res) => {
  try {
    const user = req.user;
    const recent = await Product.find({ user: user._id }).sort({ createdAt: -1 }).limit(10);
    res.json({
      name: user.name,
      email: user.email,
      // 🟢 Include avatar field
      avatar: user.avatar, 
      plan: user.plan,
      planExpiry: user.planExpiry,
      productCount: user.productCount,
      recentProducts: recent
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/**
 * GET /api/user/reports?month=&year= (Premium only)
 * Calculates waste for a given month.
 */
export const getUserMonthlyReport = async (req, res) => {
  try {
    if (!["Monthly", "Yearly"].includes(req.user.plan)) {
      return res.status(403).json({ message: "Premium required to access detailed reports" });
    }

    const now = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year = parseInt(req.query.year) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // monthly waste: products with expiryDate within month and not used (wasted)
    const agg = await Product.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user._id), expiryDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalWaste: { $sum: "$price" }, count: { $sum: 1 } } }
    ]);

    const totalWaste = (agg[0] && agg[0].totalWaste) || 0;
    const count = (agg[0] && agg[0].count) || 0;

    res.json({ month, year, totalWaste, wastedCount: count });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ---------------------------------------------------------------------

/**
 * PUT /api/user/profile
 * Updates user details (name, email) and handles profile image (avatar) upload.
 */
export const updateUserProfile = async (req, res) => {
  try {
    const user = req.user; 
    const { name, email } = req.body;
    let avatarPath = user.avatar; 

    // 1. Handle File Upload (Multer populates req.file)
    if (req.file) {
      avatarPath = req.file.path.replace(/\\/g, "/"); 

      // 2. Delete the OLD local image file (Cleanup)
      const isOldAvatarLocal = user.avatar && !user.avatar.startsWith("http") && !user.avatar.includes("default");

      if (isOldAvatarLocal) {
        fs.unlink(user.avatar, (err) => {
          if (err) console.log("Failed to delete old avatar:", err);
        });
      }
    } else if (req.body.avatar) {
      // Allow clearing the avatar or setting a new URL if explicitly sent
      avatarPath = req.body.avatar;
    }
    
    // 3. Update Fields
    user.name = name || user.name;
    user.email = email || user.email; 
    user.avatar = avatarPath; // Update with new path or keep old

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
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