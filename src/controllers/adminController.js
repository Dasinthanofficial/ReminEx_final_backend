// import Product from "../models/Product.js";
// import User from "../models/User.js";
// import Subscription from "../models/Subscription.js";
// import mongoose from "mongoose";

// // ✅ Admin Dashboard Stats
// export const getAdminDashboard = async (req, res) => {
//   try {
//     const now = new Date();
//     const month = parseInt(req.query.month) || (now.getMonth() + 1);
//     const year = parseInt(req.query.year) || now.getFullYear();
//     const start = new Date(year, month - 1, 1);
//     const end = new Date(year, month, 0, 23, 59, 59, 999);

//     // Basic Counts
//     const totalUsers = await User.countDocuments();
//     const premiumUsers = await User.countDocuments({ plan: { $in: ["Monthly", "Yearly"] } });

//     // Calculate Waste stats for the specific month
//     const wasteAgg = await Product.aggregate([
//       { $match: { expiryDate: { $gte: start, $lte: end } } },
//       { $group: { _id: null, totalWaste: { $sum: "$price" }, count: { $sum: 1 } } }
//     ]);

//     const totalWaste = (wasteAgg[0] && wasteAgg[0].totalWaste) || 0;
//     const wastedCount = (wasteAgg[0] && wasteAgg[0].count) || 0;

//     // Calculate Revenue for the specific month
//     const revenueAgg = await Subscription.aggregate([
//       { $match: { createdAt: { $gte: start, $lte: end }, status: "active" } },
//       { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
//     ]);
//     const totalRevenue = (revenueAgg[0] && revenueAgg[0].totalRevenue) || 0;

//     res.json({ month, year, totalUsers, premiumUsers, totalWaste, wastedCount, totalRevenue });
//   } catch (err) { 
//     console.error("Admin Dashboard Error:", err);
//     res.status(500).json({ message: err.message }); 
//   }
// };

// // ✅ Get All Users (For Admin Users Page)
// export const getAllUsers = async (req, res) => {
//   try {
//     // Return all users, sorted by newest first, excluding passwords
//     const users = await User.find().select("-password -otp -otpExpires").sort({ createdAt: -1 });
//     res.json(users);
//   } catch (err) {
//     console.error("Get Users Error:", err);
//     res.status(500).json({ message: err.message });
//   }
// };

// // ✅ Delete a User (For Admin Users Page)
// export const deleteUser = async (req, res) => {
//   try {
//     const userToDelete = await User.findById(req.params.id);
    
//     if (!userToDelete) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Prevent Admin from deleting themselves
//     if (userToDelete._id.toString() === req.user._id.toString()) {
//       return res.status(400).json({ message: "You cannot delete your own admin account" });
//     }

//     // Optional: Delete user's products and subscriptions to clean up DB
//     await Product.deleteMany({ user: userToDelete._id });
//     await Subscription.deleteMany({ user: userToDelete._id });
    
//     await User.findByIdAndDelete(req.params.id);

//     res.json({ message: "User and their data deleted successfully" });
//   } catch (err) {
//     console.error("Delete User Error:", err);
//     res.status(500).json({ message: err.message });
//   }
// };

import Product from "../models/Product.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import mongoose from "mongoose";
import sendEmail from "../utils/sendEmail.js"; // 👈 Import sendEmail

// ✅ Admin Dashboard Stats
export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year = parseInt(req.query.year) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // Basic Counts
    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ plan: { $in: ["Monthly", "Yearly"] } });

    // Calculate Waste stats for the specific month
    const wasteAgg = await Product.aggregate([
      { $match: { expiryDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalWaste: { $sum: "$price" }, count: { $sum: 1 } } }
    ]);

    const totalWaste = (wasteAgg[0] && wasteAgg[0].totalWaste) || 0;
    const wastedCount = (wasteAgg[0] && wasteAgg[0].count) || 0;

    // Calculate Revenue for the specific month
    const revenueAgg = await Subscription.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: "active" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]);
    const totalRevenue = (revenueAgg[0] && revenueAgg[0].totalRevenue) || 0;

    res.json({ month, year, totalUsers, premiumUsers, totalWaste, wastedCount, totalRevenue });
  } catch (err) { 
    console.error("Admin Dashboard Error:", err);
    res.status(500).json({ message: err.message }); 
  }
};

// ✅ Get All Users (For Admin Users Page)
export const getAllUsers = async (req, res) => {
  try {
    // Return all users, sorted by newest first, excluding passwords
    const users = await User.find().select("-password -otp -otpExpires").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Delete a User (For Admin Users Page)
export const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    
    if (!userToDelete) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent Admin from deleting themselves
    if (userToDelete._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own admin account" });
    }

    // Delete user's products and subscriptions to clean up DB
    await Product.deleteMany({ user: userToDelete._id });
    await Subscription.deleteMany({ user: userToDelete._id });
    
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: "User and their data deleted successfully" });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Send Promotion Email (Admin Only)
export const sendPromotionEmail = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    // 1. Get all users
    const users = await User.find().select("email name");
    
    if (!users.length) {
      return res.status(404).json({ message: "No users found" });
    }

    console.log(`📧 Preparing to send promotion to ${users.length} users...`);

    let sentCount = 0;
    
    // Run in background (don't block response)
    (async () => {
      for (const user of users) {
        try {
          const personalizedHtml = `
            <div style="font-family: sans-serif; padding: 20px; background-color: #f4f4f4;">
              <div style="background: white; padding: 20px; border-radius: 10px; max-width: 600px; margin: auto;">
                <h2 style="color: #38E07B;">Food Expiry Tracker</h2>
                <p>Hi ${user.name},</p>
                <div style="font-size: 16px; color: #333; line-height: 1.6;">
                  ${message.replace(/\n/g, "<br>")} 
                </div>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">You received this email because you are a registered user.</p>
              </div>
            </div>
          `;

          await sendEmail(user.email, subject, message, personalizedHtml);
          sentCount++;
        } catch (err) {
          console.error(`Failed to send to ${user.email}`);
        }
      }
      console.log(`✅ Promotion sent to ${sentCount} users.`);
    })();

    res.json({ message: `Promotion started for ${users.length} users.` });

  } catch (err) {
    console.error("Promotion Error:", err);
    res.status(500).json({ message: err.message });
  }
};