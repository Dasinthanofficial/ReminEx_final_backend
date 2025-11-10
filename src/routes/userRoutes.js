// src/routes/userRoutes.js
import express from "express";
import { getUserDashboard, getUserMonthlyReport } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkPlanExpiry, requirePremium } from "../middleware/checkPlanExpiry.js";
import { validateMonthYear } from "../middleware/validators.js";

const router = express.Router();

// ✅ Apply authentication and plan expiry check to all routes
router.use(protect, checkPlanExpiry);

// ✅ Dashboard - available to all authenticated users
router.get("/dashboard", getUserDashboard);

// ✅ Monthly reports - PREMIUM ONLY feature
router.get("/reports", validateMonthYear, requirePremium, getUserMonthlyReport);

export default router;