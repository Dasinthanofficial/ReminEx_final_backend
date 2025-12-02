// src/controllers/recipeController.js
import SavedRecipe from "../models/SavedRecipe.js";
import Product from "../models/Product.js";

// GET /api/products/recipes/saved
export const getSavedRecipes = async (req, res) => {
  try {
    const recipes = await SavedRecipe.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(recipes);
  } catch (err) {
    console.error("❌ getSavedRecipes error:", err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/products/recipes/save
export const saveRecipe = async (req, res) => {
  try {
    const { productId, productName, recipeText, expiryDate } = req.body;

    if (!productName || !recipeText) {
      return res
        .status(400)
        .json({ message: "productName and recipeText are required" });
    }

    let productRef = null;

    if (productId) {
      const product = await Product.findOne({
        _id: productId,
        user: req.user._id,
      }).select("_id");
      if (product) productRef = product._id;
    }

    const saved = await SavedRecipe.create({
      user: req.user._id,
      product: productRef,
      productName,
      recipeText,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ saveRecipe error:", err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/products/recipes/:id
export const deleteSavedRecipe = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await SavedRecipe.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!existing) {
      return res.status(404).json({ message: "Saved recipe not found" });
    }

    await existing.deleteOne();
    res.json({ message: "Saved recipe deleted" });
  } catch (err) {
    console.error("❌ deleteSavedRecipe error:", err);
    res.status(500).json({ message: err.message });
  }
};