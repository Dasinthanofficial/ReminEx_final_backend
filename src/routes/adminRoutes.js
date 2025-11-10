import express from "express";
import { getAdminDashboard } from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { validateMonthYear } from "../middleware/validators.js";

const router = express.Router();

// ✅ Admin dashboard - with optional month/year filtering
router.get("/dashboard", protect, adminOnly, validateMonthYear, getAdminDashboard);

export default router;