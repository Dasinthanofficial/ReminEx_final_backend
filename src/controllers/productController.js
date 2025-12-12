import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";

/**
 * Helper: upload a buffer to Cloudinary
 */
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

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
      return res.status(403).json({
        message: "Free plan allows only 5 products. Upgrade to Premium.",
        currentCount,
        maxAllowed: 5,
      });
    }

    // Handle image: URL or upload to Cloudinary
    let imagePath = req.body.image || "";

    if (req.file && req.file.buffer) {
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
      expiryDate,
      price,
      category,
      image: imagePath || undefined,
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

    if (req.file && req.file.buffer) {
      const uploadResult = await uploadBufferToCloudinary(
        req.file.buffer,
        "reminex/products"
      );
      imagePath = uploadResult.secure_url;
    } else if (req.body.image) {
      // Direct URL from client
      imagePath = req.body.image;
    }

    Object.assign(product, {
      name: name ?? product.name,
      weight: weight ?? product.weight,
      unit: unit ?? product.unit,
      expiryDate: expiryDate ?? product.expiryDate,
      price: price ?? product.price,
      category: category ?? product.category,
      image: imagePath || product.image,
    });

    await product.save();
    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 🟢  DELETE product + decrement counter
 * (Images live in Cloudinary; no local file to delete)
 */
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!product)
      return res.status(404).json({ message: "Product not found" });

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
