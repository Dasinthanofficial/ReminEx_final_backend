import express from "express";
import { 
  getAdminDashboard, 
  getAllUsers, 
  deleteUser,
  sendPromotionEmail 
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { validateMonthYear, validateMongoId } from "../middleware/validators.js";

const router = express.Router();


router.get("/dashboard", protect, adminOnly, validateMonthYear, getAdminDashboard);


router.get("/users", protect, adminOnly, getAllUsers);


router.delete("/users/:id", protect, adminOnly, validateMongoId, deleteUser);


router.post("/promote", protect, adminOnly, sendPromotionEmail);

export default router;