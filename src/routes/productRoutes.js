// src/routes/productRoutes.js
import express from "express";
import {
  getProducts,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import {
  getRecipeSuggestion,
  translateText,          // 🟢 import translateText
} from "../controllers/geminiController.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkPlanExpiry, requirePremium } from "../middleware/checkPlanExpiry.js";
import {
  validateProduct,
  validateProductUpdate,
  validateMongoId,
} from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// 🛡️ Protect all routes & check plan expiry first
router.use(protect, checkPlanExpiry);

// AI: recipe suggestions (premium users only)
router.post("/recipe", requirePremium, getRecipeSuggestion);

// 🟢 AI: translate recipe text (you can keep this free or add requirePremium)
router.post("/translate", translateText);

// ✅ Get products
router.get("/", getProducts);

// ✅ Get single product
router.get("/:id", validateMongoId, getProduct);

// ✅ Add product (supports image file or URL)
router.post(
  "/",
  upload.single("image"),   // field name must match frontend FormData key
  validateProduct,
  addProduct
);

// ✅ Update existing product
router.put(
  "/:id",
  validateMongoId,
  upload.single("image"),
  validateProductUpdate,
  updateProduct
);

// ✅ Delete product
router.delete("/:id", validateMongoId, deleteProduct);

export default router;