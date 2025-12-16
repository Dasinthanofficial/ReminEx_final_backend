import {
  getAdminDashboard,
  getAllUsers,
  deleteUser,
  sendPromotionEmail,
  uploadAdminImage,
  updateUserRole,      // 👈 add this
} from "../controllers/adminController.js";

import { protect, adminOnly, superAdminOnly } from "../middleware/authMiddleware.js";

import { protect, adminOnly, superAdminOnly } from "../middleware/authMiddleware.js";
import { validateMonthYear, validateMongoId } from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/dashboard", protect, adminOnly, validateMonthYear, getAdminDashboard);
router.get("/users", protect, adminOnly, getAllUsers);
router.delete("/users/:id", protect, adminOnly, validateMongoId, deleteUser);
router.post("/promote", protect, adminOnly, sendPromotionEmail);

// ✅ NEW route used by AdminPromotion ReactQuill image upload
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