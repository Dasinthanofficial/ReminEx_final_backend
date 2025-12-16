import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Protect routes with JWT auth.
 */
export const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }

  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      "-password -otp -otpExpires"
    );
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid" });
  }
};

/**
 * Allow only admins (includes superadmin).
 */
export const adminOnly = (req, res, next) => {
  if (!["admin", "superadmin"].includes(req.user?.role)) {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

/**
 * Allow only superadmins.
 */
export const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    return res.status(403).json({ message: "Super admin only" });
  }
  next();
};

/**
 * Check if user's plan has expired; if so, downgrade to Free.
 * Use after `protect` on routes that care about plan status.
 */
export const checkPlanExpiry = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.plan === "Free") return next();

    if (user.planExpiry && new Date() > new Date(user.planExpiry)) {
      console.log(
        `⏰ Plan expired for user ${user.email}. Downgrading to Free.`
      );

      user.plan = "Free";
      user.planExpiry = null;
      await user.save();

      req.user = user;
    }

    next();
  } catch (err) {
    console.error("Error checking plan expiry:", err);
    next();
  }
};

/**
 * Require a premium plan (Monthly/Yearly).
 * Use after `protect` + `checkPlanExpiry`.
 */
export const requirePremium = (req, res, next) => {
  const user = req.user;

  if (!["Monthly", "Yearly"].includes(user.plan)) {
    return res.status(403).json({
      message:
        "This feature requires a premium subscription. Please upgrade your plan.",
      currentPlan: user.plan,
      upgradeUrl: "/plans",
    });
  }

  next();
};