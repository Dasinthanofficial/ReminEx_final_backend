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

const router = express.Router();

// ✅ Check plan expiry on all product routes
router.use(protect, checkPlanExpiry);

// Basic product CRUD - all users
router.post("/", addProduct);
router.get("/", getProducts);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

// ✅ Recipe suggestions - premium only
router.post("/recipe", requirePremium, getRecipeSuggestion);
router.post("/:id/recipe", protect, getRecipeSuggestion);

export default router;