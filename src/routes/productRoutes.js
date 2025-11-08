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

const router = express.Router();

router.post("/", protect, addProduct);
router.get("/", protect, getProducts);
router.get("/:id", protect, getProduct);
router.put("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);

// ✅ FIXED: use the correct function name
router.post("/:id/recipe", protect, getRecipeSuggestion);

export default router;
