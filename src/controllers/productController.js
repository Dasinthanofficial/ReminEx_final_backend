import Product from "../models/Product.js";
import fs from "fs";
import path from "path";

/**
 * 🟢  GET all products for current user
 */
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id }).sort({ createdAt: -1 });
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
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: "Product not found" });
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
    const { name, weight, expiryDate, price, category } = req.body;

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

    // ✅ Handle image path
    let imagePath = req.body.image || "";
    if (req.file) {
      // Multer gives something like "uploads/filename.png" or "src/uploads/filename.png"
      const fileName = path.basename(req.file.path);
      imagePath = `/uploads/${fileName}`; // ✅ always relative web path
    }

    // If relative, prepend base URL for frontend convenience
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const webUrl = imagePath.startsWith("http")
      ? imagePath
      : `${baseUrl}${imagePath}`;

    const product = await Product.create({
      user: req.user._id,
      name,
      weight,
      expiryDate,
      price,
      category,
      image: webUrl, // ✅ store web-visible URL
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
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { name, weight, expiryDate, price, category } = req.body;
    if (category && !["Food", "Non-Food"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    let imagePath = product.image;

    if (req.file) {
      // Remove old local image if present
      if (product.image && product.image.includes("/uploads/")) {
        const oldFile = product.image.split("/uploads/")[1];
        const deletePath = path.join(process.cwd(), "uploads", oldFile);
        fs.unlink(deletePath, () => {});
      }

      // Replace with new file
      const fileName = path.basename(req.file.path);
      imagePath = `/uploads/${fileName}`;
    } else if (req.body.image) {
      imagePath = req.body.image;
    }

    // Ensure final web URL
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const webUrl = imagePath.startsWith("http")
      ? imagePath
      : `${baseUrl}${imagePath}`;

    Object.assign(product, {
      name: name ?? product.name,
      weight: weight ?? product.weight,
      expiryDate: expiryDate ?? product.expiryDate,
      price: price ?? product.price,
      category: category ?? product.category,
      image: webUrl,
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
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Remove old local file
    if (product.image && product.image.includes("/uploads/")) {
      const fileName = product.image.split("/uploads/")[1];
      const filePath = path.join(process.cwd(), "uploads", fileName);
      fs.unlink(filePath, () => {});
    }

    req.user.productCount = Math.max(0, (req.user.productCount || 0) - 1);
    await req.user.save();

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ message: err.message });
  }
};