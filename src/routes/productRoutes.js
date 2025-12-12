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
// import {
//   getSavedRecipes,
//   saveRecipe,
//   deleteSavedRecipe,
// } from "../controllers/recipeController.js";
// import {
//   scanProductByBarcode,
//   // scanLabelImage, // uncomment when you add OCR
// } from "../controllers/scanController.js";

// const router = express.Router();

// // 🛡️ Protect all routes & check plan expiry first
// router.use(protect, checkPlanExpiry);

// // 🧠 AI: recipe suggestions (premium users only)
// router.post("/recipe", requirePremium, getRecipeSuggestion);

// // 🌍 AI: translate recipe text (premium only)
// router.post("/translate", requirePremium, translateText);

// // 💾 Saved recipes
// router.get("/recipes/saved", getSavedRecipes);
// router.post("/recipes/save", saveRecipe);
// router.delete("/recipes/:id", deleteSavedRecipe);

// // 🔎 Scan product by barcode (Open Food Facts)
// router.get("/scan/barcode/:code", scanProductByBarcode);

// // 🔎 Scan label image for expiry/weight (if you want OCR later)
// // router.post("/scan/label", upload.single("image"), scanLabelImage);

// // ✅ Get products
// router.get("/", getProducts);

// // ✅ Get single product
// router.get("/:id", validateMongoId, getProduct);

// // ✅ Add product (supports image file or URL)
// router.post(
//   "/",
//   upload.single("image"),
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
import {
  scanProductByBarcode,
  // scanLabelImage, // removed label OCR
} from "../controllers/scanController.js";

const router = express.Router();

// 🛡️ Protect all routes & check plan expiry first
router.use(protect, checkPlanExpiry);

// 🧠 AI: recipe suggestions (premium users only)
router.post("/recipe", requirePremium, getRecipeSuggestion);

// 🌍 AI: translate recipe text (premium only)
router.post("/translate", requirePremium, translateText);

// 💾 Saved recipes
router.get("/recipes/saved", getSavedRecipes);
router.post("/recipes/save", saveRecipe);
router.delete("/recipes/:id", deleteSavedRecipe);

// 🔎 Scan product by barcode (Open Food Facts)
router.get("/scan/barcode/:code", scanProductByBarcode);

// 🔎 (Label OCR removed) – no /scan/label route

// ✅ Get products
router.get("/", getProducts);

// ✅ Get single product
router.get("/:id", validateMongoId, getProduct);

// ✅ Add product (supports image file or URL)
router.post(
  "/",
  upload.single("image"),
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