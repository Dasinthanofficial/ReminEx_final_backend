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
//   // scanLabelImage, // OCR removed
// } from "../controllers/scanController.js";
// import {
//   predictSpoilageFromImage,  // 👈 NEW: HF vision-based spoilage prediction
// } from "../controllers/visionController.js";

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

// // 🧠 AI Vision: predict spoilage for fruits/vegetables from an image
// // Frontend sends multipart/form-data with field "image"
// router.post(
//   "/predict-image",
//   upload.single("image"),
//   predictSpoilageFromImage
// );

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
import { getRecipeSuggestion, translateText } from "../controllers/geminiController.js";
import { protect, checkPlanExpiry, requirePremium } from "../middleware/authMiddleware.js";
import { validateProduct, validateProductUpdate, validateMongoId } from "../middleware/validators.js";
import upload from "../middleware/uploadMiddleware.js";
import { getSavedRecipes, saveRecipe, deleteSavedRecipe } from "../controllers/recipeController.js";
import { scanProductByBarcode } from "../controllers/scanController.js";
import { predictSpoilageFromImage } from "../controllers/visionController.js";

// ✅ NEW: Tesseract OCR controller
import { extractProductFromImagesTesseract } from "../controllers/ocrController.js";

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

// 🧠 AI Vision: predict spoilage for fruits/vegetables from an image
router.post("/predict-image", upload.single("image"), predictSpoilageFromImage);

// ✅ OCR from front/back images (Tesseract)
router.post(
  "/ocr",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  extractProductFromImagesTesseract
);

// ✅ Get products
router.get("/", getProducts);

// ✅ Get single product
router.get("/:id", validateMongoId, getProduct);

// ✅ Add product (supports image file or URL)
router.post("/", upload.single("image"), validateProduct, addProduct);

// ✅ Update existing product
router.put("/:id", validateMongoId, upload.single("image"), validateProductUpdate, updateProduct);

// ✅ Delete product
router.delete("/:id", validateMongoId, deleteProduct);

export default router;