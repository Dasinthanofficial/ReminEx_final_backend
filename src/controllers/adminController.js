import Product from "../models/Product.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import sendEmail from "../utils/sendEmail.js";
import { startOfLocalDay, monthRangeLocal } from "../utils/dates.js";
import cloudinary from "../config/cloudinary.js";

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

// ✅ Admin Dashboard Stats - calendar-based waste calculation
export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    const { start, end } = monthRangeLocal(year, month);

    // Start of TODAY (local calendar day)
    const today = startOfLocalDay();

    // Basic Counts
    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({
      plan: { $in: ["Monthly", "Yearly"] },
    });

    // 1️⃣ Total waste (only expired in selected month)
    const wasteAgg = await Product.aggregate([
      {
        $match: {
          expiryDate: {
            $gte: start,
            $lte: end,
            $lt: today,
          },
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

    const totalWaste = wasteAgg[0]?.totalWaste || 0;
    const wastedCount = wasteAgg[0]?.count || 0;

    // 2️⃣ Waste by category (Food vs Non-Food)
    const wasteByCatAgg = await Product.aggregate([
      {
        $match: {
          expiryDate: { $gte: start, $lte: end, $lt: today },
        },
      },
      {
        $group: {
          _id: "$category",
          totalWaste: { $sum: { $ifNull: ["$price", 0] } },
        },
      },
    ]);

    const wasteByCategory = { food: 0, nonFood: 0 };
    for (const row of wasteByCatAgg) {
      if (row._id === "Food") wasteByCategory.food = row.totalWaste;
      if (row._id === "Non-Food") wasteByCategory.nonFood = row.totalWaste;
    }

    // 3️⃣ Revenue for the specific month (USD only)
    const revenueAgg = await Subscription.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: "active",
          currency: "USD",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    const stats = {
      month,
      year,
      totalUsers,
      premiumUsers,
      totalWaste: Math.round(totalWaste * 100) / 100,
      wastedCount,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      wasteByCategory,
      debug: {
        queryRange: `${start.toDateString()} to ${end.toDateString()}`,
        today: today.toDateString(),
        currentDateTime: now.toString(),
        monthName: start.toLocaleString("default", { month: "long", year: "numeric" }),
      },
    };

    res.json(stats);
  } catch (err) {
    console.error("❌ Admin Dashboard Error:", err);
    res.status(500).json({
      message: err.message,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// ✅ Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "user",
          as: "products",
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "user",
          as: "subscriptions",
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          plan: 1,
          planExpiry: 1,
          createdAt: 1,
          productCount: { $size: "$products" },
          hasActiveSubscription: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$subscriptions",
                    cond: { $eq: ["$$this.status", "active"] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    res.json(users);
  } catch (err) {
    console.error("❌ Get Users Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Delete a User
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

    // Prevent deleting any admins / superadmins via this endpoint
    if (["admin", "superadmin"].includes(userToDelete.role)) {
      return res
        .status(403)
        .json({ message: "Cannot delete admin or superadmin accounts" });
    }
    const productCount = await Product.countDocuments({ user: userToDelete._id });
    const subscriptionCount = await Subscription.countDocuments({ user: userToDelete._id });

    await Product.deleteMany({ user: userToDelete._id });
    await Subscription.deleteMany({ user: userToDelete._id });
    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: "User and their data deleted successfully",
      deletedData: {
        user: userToDelete.email,
        productsDeleted: productCount,
        subscriptionsDeleted: subscriptionCount,
      },
    });
  } catch (err) {
    console.error("❌ Delete User Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Send Promotion Email (Admin Only)
export const sendPromotionEmail = async (req, res) => {
  try {
    const { subject, message, targetAudience = "all" } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    let userQuery = {};
    if (targetAudience === "free") userQuery = { plan: "Free" };
    if (targetAudience === "premium") userQuery = { plan: { $in: ["Monthly", "Yearly"] } };

    const users = await User.find(userQuery).select("email name plan");

    if (!users.length) {
      return res.status(404).json({ message: "No users found for selected audience" });
    }

    let sentCount = 0;
    let failedCount = 0;
    const failedEmails = [];

    (async () => {
      for (const user of users) {
        try {
          const personalizedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; background-color: #f4f4f4; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
                .logo { color: white; font-size: 28px; font-weight: bold; text-decoration: none; }
                .content { background: white; padding: 30px; margin: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .button { display: inline-block; padding: 12px 30px; background-color: #38E07B; color: #122017; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .unsubscribe { color: #999; text-decoration: underline; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <a href="${process.env.CLIENT_URL}" class="logo">ReminEx</a>
                </div>
                <div class="content">
                  <h2>Hi ${user.name}!</h2>
                  <div style="font-size: 16px; color: #333; line-height: 1.6;">
                    ${message}
                  </div>
                  ${
                    user.plan === "Free"
                      ? `<a href="${process.env.CLIENT_URL}/plans" class="button">Upgrade to Premium</a>`
                      : ""
                  }
                </div>
                <div class="footer">
                  <p>You received this email because you are a ${user.plan} member of ReminEx.</p>
                  <p><a href="${process.env.CLIENT_URL}/unsubscribe" class="unsubscribe">Unsubscribe</a></p>
                </div>
              </div>
            </body>
            </html>
          `;

          const plainText = message
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          await sendEmail(user.email, subject, plainText, personalizedHtml);
          sentCount++;
        } catch (err) {
          failedCount++;
          failedEmails.push(user.email);
          console.error(`❌ Failed to send to ${user.email}:`, err.message);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(`📊 Email campaign complete: ${sentCount} sent, ${failedCount} failed`);
      if (failedEmails.length) console.log("Failed emails:", failedEmails);
    })();

    res.json({
      message: `Email campaign started for ${users.length} users`,
      audience: targetAudience,
      totalUsers: users.length,
      status: "processing",
    });
  } catch (err) {
    console.error("❌ Promotion Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get waste details for debugging
export const getWasteDetails = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    const { start, end } = monthRangeLocal(year, month);
    const today = startOfLocalDay();

    const allProducts = await Product.find({
      expiryDate: { $gte: start, $lte: end },
    }).populate("user", "name email");

    const expired = allProducts.filter((p) => p.expiryDate < today);
    const notExpired = allProducts.filter((p) => p.expiryDate >= today);

    res.json({
      month,
      year,
      currentDateTime: now.toString(),
      dateRange: {
        start: start.toDateString(),
        end: end.toDateString(),
      },
      summary: {
        totalProductsInMonth: allProducts.length,
        expiredCount: expired.length,
        notExpiredYet: notExpired.length,
        totalWasteValue: expired.reduce((sum, p) => sum + (p.price || 0), 0),
      },
      expiredProducts: expired.map((p) => ({
        name: p.name,
        price: p.price,
        expiryDate: p.expiryDate,
        daysAgo: Math.floor((today - p.expiryDate) / (1000 * 60 * 60 * 24)),
        user: p.user?.name || "Unknown",
      })),
      upcomingExpiry: notExpired.map((p) => ({
        name: p.name,
        price: p.price,
        expiryDate: p.expiryDate,
        daysUntil: Math.floor((p.expiryDate - today) / (1000 * 60 * 60 * 24)),
        user: p.user?.name || "Unknown",
      })),
    });
  } catch (err) {
    console.error("❌ Waste Details Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ NEW: Upload image for AdminPromotion (ReactQuill image button)
export const uploadAdminImage = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      "reminex/promotions"
    );

    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    console.error("uploadAdminImage error:", err);
    return res.status(500).json({ message: "Failed to upload image" });
  }
};

// ✅ SUPER ADMIN: update a user's role
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // "user" | "admin" | "superadmin"

    if (!["user", "admin", "superadmin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Prevent changing own role (safety)
    if (id === String(req.user._id)) {
      return res
        .status(400)
        .json({ message: "You cannot change your own role" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = role;
    await user.save();

    res.json({
      message: "User role updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ UpdateUserRole Error:", err);
    res.status(500).json({ message: err.message });
  }
};