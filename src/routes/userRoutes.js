// src/routes/userRoutes.js
import express from "express";
import {
  getUserDashboard,
  getUserMonthlyReport,
  updateUserProfile,
} from "../controllers/userController.js";
import {
  protect,
  checkPlanExpiry,
  requirePremium,
} from "../middleware/authMiddleware.js";
import { validateMonthYear } from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ✅ Apply authentication and plan expiry check to all routes
router.use(protect, checkPlanExpiry);

// ✅ Dashboard - available to all authenticated users
router.get("/dashboard", getUserDashboard);

// ✅ Monthly reports - PREMIUM ONLY feature
router.get("/reports", validateMonthYear, requirePremium, getUserMonthlyReport);

// ✅ Profile update (name + avatar)
router.put("/profile", upload.single("avatar"), updateUserProfile);

export default router;