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

// ✅ Option 1: default upload (5MB) + OCR upload (10MB)
import upload, { uploadOCR } from "../middleware/uploadMiddleware.js";

import {
  getSavedRecipes,
  saveRecipe,
  deleteSavedRecipe,
} from "../controllers/recipeController.js";

import { scanProductByBarcode } from "../controllers/scanController.js";
import { predictSpoilageFromImage } from "../controllers/visionController.js";

// ✅ OCR controller (Tesseract)
import { extractProductFromImagesTesseract } from "../controllers/ocrController.js";

const router = express.Router();

// 🛡️ All routes below require login + plan expiry check
router.use(protect, checkPlanExpiry);

// ----------------------------------------------------
// AI / Utilities
// ----------------------------------------------------

// 🧠 AI recipes (premium only)
router.post("/recipe", requirePremium, getRecipeSuggestion);

// 🌍 Translate (premium only)
router.post("/translate", requirePremium, translateText);

// 🔎 Barcode scan (OpenFoodFacts)
router.get("/scan/barcode/:code", scanProductByBarcode);

// 🧠 Vision: predict spoilage from image (5MB limit)
router.post("/predict-image", upload.single("image"), predictSpoilageFromImage);

// ✅ OCR: extract product info from front/back images (10MB per file, max 2 files)
router.post(
  "/ocr",
  uploadOCR.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  extractProductFromImagesTesseract
);

// ----------------------------------------------------
// Saved recipes
// ----------------------------------------------------
router.get("/recipes/saved", getSavedRecipes);
router.post("/recipes/save", saveRecipe);
router.delete("/recipes/:id", deleteSavedRecipe);

// ----------------------------------------------------
// Products CRUD
// ----------------------------------------------------
router.get("/", getProducts);

// ⚠️ MUST stay below "/ocr" (otherwise "ocr" gets treated as ":id")
router.get("/:id", validateMongoId, getProduct);

// Add product (5MB limit)
router.post("/", upload.single("image"), validateProduct, addProduct);

// Update product (5MB limit)
router.put(
  "/:id",
  validateMongoId,
  upload.single("image"),
  validateProductUpdate,
  updateProduct
);

router.delete("/:id", validateMongoId, deleteProduct);

export default router;