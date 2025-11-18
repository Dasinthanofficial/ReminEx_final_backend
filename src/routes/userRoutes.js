import express from "express";
import { getUserDashboard, getUserMonthlyReport, updateUserProfile } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkPlanExpiry, requirePremium } from "../middleware/checkPlanExpiry.js";
import { validateMonthYear } from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js"; // ⚠️ Import the upload middleware

const router = express.Router();

// ✅ Apply authentication and plan expiry check to all routes
router.use(protect, checkPlanExpiry);

// ✅ Dashboard - available to all authenticated users
router.get("/dashboard", getUserDashboard);

// ✅ Monthly reports - PREMIUM ONLY feature
router.get("/reports", validateMonthYear, requirePremium, getUserMonthlyReport);

// 🟢 NEW PROFILE UPDATE ROUTE
// 1. upload.single('avatar') handles the incoming image file.
// 2. updateUserProfile handles the database update and file cleanup.
router.put(
  "/profile", 
  upload.single("avatar"), 
  updateUserProfile
);

export default router;