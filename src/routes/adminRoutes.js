import express from "express";
import { getAdminDashboard } from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/dashboard", protect, adminOnly, getAdminDashboard);

// add plan/ad management routes as needed.

export default router;
