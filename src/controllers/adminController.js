import Product from "../models/Product.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import sendEmail from "../utils/sendEmail.js";

// ✅ Admin Dashboard Stats - calendar-based waste calculation
export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // Start of TODAY (calendar date)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Basic Counts
    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({
      plan: { $in: ["Monthly", "Yearly"] },
    });

    // 1️⃣ Total waste (all categories, only expired in selected month)
    // "Expired" means expiryDate is BEFORE today (calendar day)
    const wasteAgg = await Product.aggregate([
      {
        $match: {
          expiryDate: {
            $gte: start,
            $lte: end,
            $lt: today, // 👈 only dates strictly before today
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

    // 2️⃣ Waste by category (Food vs Non-Food) using the same rule
    const wasteByCatAgg = await Product.aggregate([
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
          _id: "$category",
          totalWaste: { $sum: { $ifNull: ["$price", 0] } },
        },
      },
    ]);

    const wasteByCategory = { food: 0, nonFood: 0 };
    for (const row of wasteByCatAgg) {
      if (row._id === "Food") {
        wasteByCategory.food = row.totalWaste;
      } else if (row._id === "Non-Food") {
        wasteByCategory.nonFood = row.totalWaste;
      }
    }

    // 3️⃣ Revenue for the specific month (USD only to avoid mixing currencies)
    const revenueAgg = await Subscription.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: "active",
          currency: "USD", // 👈 only include USD amounts in totalRevenue
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
        currentDate: now.toDateString(),
        monthName: start.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
      },
    };

    console.log("📊 Admin Dashboard Stats:", stats);
    res.json(stats);
  } catch (err) {
    console.error("❌ Admin Dashboard Error:", err);
    res.status(500).json({
      message: err.message,
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// ✅ Get All Users (For Admin Users Page) - ENHANCED
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

// ✅ Delete a User (For Admin Users Page) - ENHANCED
export const deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);

    if (!userToDelete) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent Admin from deleting themselves
    if (userToDelete._id.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own admin account" });
    }

    // Prevent deleting other admins
    if (userToDelete.role === "admin") {
      return res.status(403).json({ message: "Cannot delete admin accounts" });
    }

    const productCount = await Product.countDocuments({
      user: userToDelete._id,
    });
    const subscriptionCount = await Subscription.countDocuments({
      user: userToDelete._id,
    });

    await Product.deleteMany({ user: userToDelete._id });
    await Subscription.deleteMany({ user: userToDelete._id });
    await User.findByIdAndDelete(req.params.id);

    console.log(
      `✅ Deleted user ${userToDelete.email} with ${productCount} products and ${subscriptionCount} subscriptions`
    );

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

// ✅ Send Promotion Email (Admin Only) - ENHANCED
export const sendPromotionEmail = async (req, res) => {
  try {
    const { subject, message, targetAudience = "all" } = req.body;

    if (!subject || !message) {
      return res
        .status(400)
        .json({ message: "Subject and message are required" });
    }

    let userQuery = {};
    if (targetAudience === "free") {
      userQuery = { plan: "Free" };
    } else if (targetAudience === "premium") {
      userQuery = { plan: { $in: ["Monthly", "Yearly"] } };
    }

    const users = await User.find(userQuery).select("email name plan");

    if (!users.length) {
      return res
        .status(404)
        .json({ message: "No users found for selected audience" });
    }

    console.log(
      `📧 Sending promotion to ${users.length} ${targetAudience} users...`
    );

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
                body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; }
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
                  <a href="${process.env.CLIENT_URL}" class="logo">🍎 ReminEx</a>
                </div>
                <div class="content">
                  <h2>Hi ${user.name}! 👋</h2>
                  <div style="font-size: 16px; color: #333; line-height: 1.6;">
                    ${message.replace(/\n/g, "<br>")}
                  </div>
                  ${
                    user.plan === "Free"
                      ? `
                    <a href="${process.env.CLIENT_URL}/plans" class="button">Upgrade to Premium</a>
                  `
                      : ""
                  }
                </div>
                <div class="footer">
                  <p>You received this email because you are a ${
                    user.plan
                  } member of ReminEx.</p>
                  <p><a href="${
                    process.env.CLIENT_URL
                  }/unsubscribe" class="unsubscribe">Unsubscribe from promotional emails</a></p>
                </div>
              </div>
            </body>
            </html>
          `;

          await sendEmail(user.email, subject, message, personalizedHtml);
          sentCount++;
          console.log(`✅ Sent to ${user.email}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${user.email}:`, err.message);
          failedCount++;
          failedEmails.push(user.email);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(
        `📊 Email campaign complete: ${sentCount} sent, ${failedCount} failed`
      );
      if (failedEmails.length > 0) {
        console.log("Failed emails:", failedEmails);
      }
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

// ✅ NEW: Get waste details for debugging
export const getWasteDetails = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // Start of today for consistent "expired" definition
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allProducts = await Product.find({
      expiryDate: { $gte: start, $lte: end },
    }).populate("user", "name email");

    const expired = allProducts.filter((p) => p.expiryDate < today);
    const notExpired = allProducts.filter((p) => p.expiryDate >= today);

    res.json({
      month,
      year,
      currentDate: now,
      dateRange: {
        start: start.toDateString(),
        end: end.toDateString(),
      },
      summary: {
        totalProductsInMonth: allProducts.length,
        expiredCount: expired.length,
        notExpiredYet: notExpired.length,
        totalWasteValue: expired.reduce(
          (sum, p) => sum + (p.price || 0),
          0
        ),
      },
      expiredProducts: expired.map((p) => ({
        name: p.name,
        price: p.price,
        expiryDate: p.expiryDate,
        daysAgo: Math.floor(
          (today - p.expiryDate) / (1000 * 60 * 60 * 24)
        ),
        user: p.user?.name || "Unknown",
      })),
      upcomingExpiry: notExpired.map((p) => ({
        name: p.name,
        price: p.price,
        expiryDate: p.expiryDate,
        daysUntil: Math.floor(
          (p.expiryDate - today) / (1000 * 60 * 60 * 24)
        ),
        user: p.user?.name || "Unknown",
      })),
    });
  } catch (err) {
    console.error("❌ Waste Details Error:", err);
    res.status(500).json({ message: err.message });
  }
};