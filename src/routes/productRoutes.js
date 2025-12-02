// // src/routes/productRoutes.js
// import express from "express";
// import {
//   getProducts,
//   getProduct,
//   addProduct,
//   updateProduct,
//   deleteProduct,
// } from "../controllers/productController.js";
// import {
//   getRecipeSuggestion,
//   translateText,
// } from "../controllers/geminiController.js";
// import {
//   protect,
//   checkPlanExpiry,
//   requirePremium,
// } from "../middleware/authMiddleware.js";
// import {
//   validateProduct,
//   validateProductUpdate,
//   validateMongoId,
// } from "../middleware/validators.js";
// import upload from "../middleware/uploadMiddleware.js";

// const router = express.Router();

// // 🛡️ Protect all routes & check plan expiry first
// router.use(protect, checkPlanExpiry);

// // AI: recipe suggestions (premium users only)
// router.post("/recipe", requirePremium, getRecipeSuggestion);

// // AI: translate recipe text (can be free or also requirePremium if you want)
// router.post("/translate", translateText);

// // ✅ Get products
// router.get("/", getProducts);

// // ✅ Get single product
// router.get("/:id", validateMongoId, getProduct);

// // ✅ Add product (supports image file or URL)
// router.post(
//   "/",
//   upload.single("image"), // field name must match frontend FormData key
//   validateProduct,
//   addProduct
// );

// // ✅ Update existing product
// router.put(
//   "/:id",
//   validateMongoId,
//   upload.single("image"),
//   validateProductUpdate,
//   updateProduct
// );

// // ✅ Delete product
// router.delete("/:id", validateMongoId, deleteProduct);

// export default router;


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
  translateText,
} from "../controllers/geminiController.js";
import {
  protect,
  checkPlanExpiry,
  requirePremium,
} from "../middleware/authMiddleware.js";
import {
  validateProduct,
  validateProductUpdate,
  validateMongoId,
} from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getSavedRecipes,
  saveRecipe,
  deleteSavedRecipe,
} from "../controllers/recipeController.js";

const router = express.Router();

// 🛡️ Protect all routes & check plan expiry first
router.use(protect, checkPlanExpiry);

// 🧠 AI: recipe suggestions (premium users only)
router.post("/recipe", requirePremium, getRecipeSuggestion);

// 🌍 AI: translate recipe text (also premium only for consistency)
router.post("/translate", requirePremium, translateText);

// 💾 Saved recipes (user can always see their saved ones)
router.get("/recipes/saved", getSavedRecipes);
router.post("/recipes/save", saveRecipe);
router.delete("/recipes/:id", deleteSavedRecipe);

// ✅ Get products
router.get("/", getProducts);

// ✅ Get single product
router.get("/:id", validateMongoId, getProduct);

// ✅ Add product (supports image file or URL)
router.post(
  "/",
  upload.single("image"), // field name must match frontend FormData key
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