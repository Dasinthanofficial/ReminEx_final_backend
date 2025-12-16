import express from "express";
import {
  getAdminDashboard,
  getAllUsers,
  deleteUser,
  sendPromotionEmail,
  uploadAdminImage,
  updateUserRole,
} from "../controllers/adminController.js";
import {
  protect,
  adminOnly,
  superAdminOnly,
} from "../middleware/authMiddleware.js";
import { validateMonthYear, validateMongoId } from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Admin dashboard stats
router.get(
  "/dashboard",
  protect,
  adminOnly,
  validateMonthYear,
  getAdminDashboard
);

// Get all users
router.get("/users", protect, adminOnly, getAllUsers);

// Delete user (no admins / superadmins via this endpoint)
router.delete(
  "/users/:id",
  protect,
  adminOnly,
  validateMongoId,
  deleteUser
);

// Send promotion emails
router.post("/promote", protect, adminOnly, sendPromotionEmail);

// Admin promotion image upload (for ReactQuill)
router.post(
  "/upload-image",
  protect,
  adminOnly,
  upload.single("image"),
  uploadAdminImage
);

// SUPER ADMIN: change user role
router.put(
  "/users/:id/role",
  protect,
  superAdminOnly,
  validateMongoId,
  updateUserRole
);

export default router;