import express from "express";
import { 
  getAdminDashboard, 
  getAllUsers, 
  deleteUser,
  sendPromotionEmail // 👈 Import the new function
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { validateMonthYear, validateMongoId } from "../middleware/validators.js";

const router = express.Router();

// ✅ Admin Dashboard Stats
// GET /api/admin/dashboard?month=12&year=2024
router.get("/dashboard", protect, adminOnly, validateMonthYear, getAdminDashboard);

// ✅ Get All Users List
// GET /api/admin/users
router.get("/users", protect, adminOnly, getAllUsers);

// ✅ Delete a User
// DELETE /api/admin/users/:id
router.delete("/users/:id", protect, adminOnly, validateMongoId, deleteUser);

// ✅ Send Promotion Email to All Users
// POST /api/admin/promote
router.post("/promote", protect, adminOnly, sendPromotionEmail); // 👈 Added route

export default router;