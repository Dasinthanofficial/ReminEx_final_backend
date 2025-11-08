import express from "express";
import { getUserDashboard, getUserMonthlyReport } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/dashboard", protect, getUserDashboard);
router.get("/reports", protect, getUserMonthlyReport);

export default router;
