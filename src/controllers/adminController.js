import Product from "../models/Product.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import mongoose from "mongoose";

export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || (now.getMonth()+1);
    const year = parseInt(req.query.year) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ plan: { $in: ["Monthly","Yearly"] } });

    const wasteAgg = await Product.aggregate([
      { $match: { expiryDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalWaste: { $sum: "$price" }, count: { $sum: 1 } } }
    ]);

    const totalWaste = (wasteAgg[0] && wasteAgg[0].totalWaste) || 0;
    const wastedCount = (wasteAgg[0] && wasteAgg[0].count) || 0;

    const revenueAgg = await Subscription.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: "active" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]);
    const totalRevenue = (revenueAgg[0] && revenueAgg[0].totalRevenue) || 0;

    res.json({ month, year, totalUsers, premiumUsers, totalWaste, wastedCount, totalRevenue });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
