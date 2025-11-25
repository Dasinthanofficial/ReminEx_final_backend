import Product from "../models/Product.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolve uploads directory (same as server.js / uploadMiddleware.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");

/**
 * 🟢  GET all products for current user
 */
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢  GET a single product by ID
 */
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!product)
      return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢  ADD product (supports image file or URL)
 * Free plan users limited to 5 products
 */
export const addProduct = async (req, res) => {
  try {
    const { name, weight, unit, expiryDate, price, category } = req.body;

    // Validate category
    if (!["Food", "Non-Food"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // Enforce Free-plan product limit
    const currentCount = req.user.productCount || 0;
    if (req.user.plan === "Free" && currentCount >= 5) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({
        message: "Free plan allows only 5 products. Upgrade to Premium.",
        currentCount,
        maxAllowed: 5,
      });
    }

    // Handle image path
    let imagePath = req.body.image || "";
    if (req.file) {
      const fileName = path.basename(req.file.path);
      imagePath = `/uploads/${fileName}`;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const webUrl = imagePath
      ? imagePath.startsWith("http")
        ? imagePath
        : `${baseUrl}${imagePath}`
      : "";

    const product = await Product.create({
      user: req.user._id,
      name,
      weight,
      unit: unit || "g",
      expiryDate,
      price,
      category,
      image: webUrl || undefined,
    });

    req.user.productCount = currentCount + 1;
    await req.user.save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢  UPDATE product (supports new file, URL, or details only)
 */
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!product)
      return res.status(404).json({ message: "Product not found" });

    const { name, weight, unit, expiryDate, price, category } = req.body;

    if (category && !["Food", "Non-Food"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    let imagePath = product.image;

    if (req.file) {
      // Remove old local image if present
      if (product.image && product.image.includes("/uploads/")) {
        const oldFile = product.image.split("/uploads/")[1];
        if (oldFile) {
          const deletePath = path.join(uploadsDir, oldFile);
          fs.unlink(deletePath, () => {});
        }
      }

      const fileName = path.basename(req.file.path);
      imagePath = `/uploads/${fileName}`;
    } else if (req.body.image) {
      imagePath = req.body.image;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const webUrl = imagePath
      ? imagePath.startsWith("http")
        ? imagePath
        : `${baseUrl}${imagePath}`
      : "";

    Object.assign(product, {
      name: name ?? product.name,
      weight: weight ?? product.weight,
      unit: unit ?? product.unit,
      expiryDate: expiryDate ?? product.expiryDate,
      price: price ?? product.price,
      category: category ?? product.category,
      image: webUrl || product.image,
    });

    await product.save();
    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢  DELETE product + image cleanup + decrement counter
 */
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!product)
      return res.status(404).json({ message: "Product not found" });

    if (product.image && product.image.includes("/uploads/")) {
      const fileName = product.image.split("/uploads/")[1];
      if (fileName) {
        const filePath = path.join(uploadsDir, fileName);
        fs.unlink(filePath, () => {});
      }
    }

    req.user.productCount = Math.max(
      0,
      (req.user.productCount || 0) - 1
    );
    await req.user.save();

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ message: err.message });
  }
};