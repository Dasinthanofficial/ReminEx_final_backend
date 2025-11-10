import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";

/** GET /api/user/dashboard */
export const getUserDashboard = async (req, res) => {
  try {
    const user = req.user;
    const recent = await Product.find({ user: user._id }).sort({ createdAt: -1 }).limit(10);
    res.json({
      name: user.name,
      email: user.email,
      plan: user.plan,
      planExpiry: user.planExpiry,
      productCount: user.productCount,
      recentProducts: recent
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

/** GET /api/user/reports?month=&year= (Premium only) */
export const getUserMonthlyReport = async (req, res) => {
  try {
    if (!["Monthly","Yearly"].includes(req.user.plan)) {
      return res.status(403).json({ message: "Premium required to access detailed reports" });
    }

    const now = new Date();
    const month = parseInt(req.query.month) || (now.getMonth()+1);
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
