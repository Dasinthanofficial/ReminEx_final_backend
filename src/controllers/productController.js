import Product from "../models/Product.js";
import RecipeSuggestion from "../models/RecipeSuggestion.js"; // ✅ FIX: import it
import cloudinary from "../config/cloudinary.js";
import { parseDateOnlyLocal } from "../utils/dates.js";

const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
};

/**
 * 🟢 GET all products for current user
 */
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    return res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢 GET a single product by ID
 */
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    return res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢 ADD product (supports image file or URL)
 * Free plan users limited to 5 products
 */
export const addProduct = async (req, res) => {
  try {
    const { name, weight, unit, expiryDate, price, category } = req.body;

    if (!["Food", "Non-Food"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const currentCount = req.user.productCount || 0;
    if (req.user.plan === "Free" && currentCount >= 5) {
      return res.status(403).json({
        message: "Free plan allows only 5 products. Upgrade to Premium.",
        currentCount,
        maxAllowed: 5,
      });
    }

    let imagePath = req.body.image || "";

    if (req.file?.buffer) {
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        "reminex/products"
      );
      imagePath = uploadResult.secure_url;
    }

    const product = await Product.create({
      user: req.user._id,
      name,
      weight,
      unit: unit || "g",
      expiryDate: expiryDate ? parseDateOnlyLocal(expiryDate) : expiryDate,
      price,
      category,
      image: imagePath || undefined,
    });

    req.user.productCount = currentCount + 1;
    await req.user.save();

    return res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("Error adding product:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢 UPDATE product (supports new file, URL, or details only)
 */
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    const { name, weight, unit, expiryDate, price, category } = req.body;

    if (category && !["Food", "Non-Food"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    let imagePath = product.image;

    if (req.file?.buffer) {
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        "reminex/products"
      );
      imagePath = uploadResult.secure_url;
    } else if (req.body.image) {
      imagePath = req.body.image;
    }

    Object.assign(product, {
      name: name ?? product.name,
      weight: weight ?? product.weight,
      unit: unit ?? product.unit,
      expiryDate: expiryDate ? parseDateOnlyLocal(expiryDate) : product.expiryDate,
      price: price ?? product.price,
      category: category ?? product.category,
      image: imagePath || product.image,
    });

    await product.save();

    return res.json({ message: "Product updated successfully", product });
  } catch (err) {
    console.error("Error updating product:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢 DELETE product + decrement counter
 */
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    // ✅ best-effort: delete cached recipes, but don’t fail deletion if this fails
    try {
      await RecipeSuggestion.deleteMany({
        user: req.user._id,
        product: product._id,
      });
    } catch (e) {
      console.warn("⚠️ Failed to delete RecipeSuggestion cache:", e?.message || e);
    }

    req.user.productCount = Math.max(0, (req.user.productCount || 0) - 1);
    await req.user.save();

    return res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    return res.status(500).json({ message: err.message });
  }
};