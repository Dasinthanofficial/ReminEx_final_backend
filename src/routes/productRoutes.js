import express from "express";
import {
  addProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";
import { getRecipeSuggestion } from "../controllers/geminiController.js";
import { protect } from "../middleware/authMiddleware.js";
import { checkPlanExpiry, requirePremium } from "../middleware/checkPlanExpiry.js";
import { validateProduct, validateProductUpdate, validateMongoId } from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js"; // Ensure this path is correct

const router = express.Router();

// Apply authentication and plan expiry check to ALL routes below
router.use(protect, checkPlanExpiry);

// ✅ GET Routes (No changes needed)
router.get("/", getProducts);
router.get("/:id", validateMongoId, getProduct);

// ✅ POST Route (Add Product)
// 1. Upload file (populates req.body & req.file)
// 2. Validate inputs
// 3. Call Controller
router.post(
  "/", 
  upload.single("image"), 
  validateProduct, 
  addProduct
);

// ✅ PUT Route (Update Product)
// Added upload.single("image") so users can update the image
router.put(
  "/:id", 
  validateMongoId, 
  upload.single("image"), 
  validateProductUpdate, 
  updateProduct
);

// ✅ DELETE Route
router.delete("/:id", validateMongoId, deleteProduct);

// ✅ AI Recipe Route
router.post("/recipe", requirePremium, getRecipeSuggestion);

export default router;