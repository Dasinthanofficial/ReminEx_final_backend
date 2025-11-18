import Product from "../models/Product.js";
import User from "../models/User.js";
import fs from "fs"; // Import file system module to delete images if needed

/**
 * Add Product (Free users <=5). 
 * Supports Image Upload via req.file
 */
export const addProduct = async (req, res) => {
  try {
    const { name, weight, expiryDate, price, category } = req.body;

    // 1. Validate category
    if (!["Food", "Non-Food"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // 2. Safe product count check
    const currentCount = req.user.productCount || 0;

    // 3. Enforce free limit
    if (req.user.plan === "Free" && currentCount >= 5) {
      // ⚠️ IMPORTANT: If user uploaded a file but failed this check, 
      // we should delete the uploaded file to save server space.
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file after limit check:", err);
        });
      }

      return res.status(403).json({
        message: "Free plan allows only 5 products. Upgrade to Premium.",
        currentCount,
        maxAllowed: 5
      });
    }

    // 4. Handle Image Path
    // If a file is uploaded, use the file path. 
    // If not, check if a URL string was sent in body (fallback).
    let imagePath = req.body.image || ""; 
    if (req.file) {
      // Standardize path slashes for Windows/Linux compatibility
      imagePath = req.file.path.replace(/\\/g, "/");
    }

    const product = await Product.create({
      user: req.user._id,
      name,
      image: imagePath, // Save the path/URL
      weight,
      expiryDate,
      price,
      category,
    });

    // 5. Increment productCount
    req.user.productCount = currentCount + 1;
    await req.user.save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: err.message });
  }
};

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

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { name, weight, expiryDate, price, category } = req.body;

    if (category && !["Food", "Non-Food"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // Handle Image Update
    let imagePath = product.image; // Default to existing image
    
    if (req.file) {
      // 1. If there's a new file, use it
      imagePath = req.file.path.replace(/\\/g, "/");

      // 2. (Optional) Delete the OLD image file from server to save space
      // Only do this if the old image was a local file (not a web URL)
      if (product.image && !product.image.startsWith("http")) {
        fs.unlink(product.image, (err) => {
           if(err) console.log("Failed to delete old image:", err);
        });
      }
    } else if (req.body.image) {
      // If they sent a string URL instead of a file
      imagePath = req.body.image;
    }

    product.name = name ?? product.name;
    product.image = imagePath;
    product.weight = weight ?? product.weight;
    product.expiryDate = expiryDate ?? product.expiryDate;
    product.price = price ?? product.price;
    product.category = category ?? product.category;

    await product.save();
    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: "Product not found" });

    // (Optional) Delete image file from server when product is deleted
    if (product.image && !product.image.startsWith("http")) {
        fs.unlink(product.image, (err) => {
           if(err) console.log("Failed to delete product image:", err);
        });
    }

    const currentCount = req.user.productCount || 0;
    req.user.productCount = Math.max(0, currentCount - 1);
    await req.user.save();

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ message: err.message });
  }
};