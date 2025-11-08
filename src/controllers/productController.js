import Product from "../models/Product.js";
import User from "../models/User.js";

/**
 * Add Product (Free users <=5). Fields: name, image, weight, expiryDate, price, category
 */
export const addProduct = async (req, res) => {
  try {
    const { name, image, weight, expiryDate, price, category } = req.body;
    // validate category
    if (!["Food", "Non-Food"].includes(category)) return res.status(400).json({ message: "Invalid category" });

    // enforce free limit
    if (req.user.plan === "Free" && req.user.productCount >= 5) {
      return res.status(403).json({ message: "Free plan allows only 5 products. Upgrade to Premium." });
    }

    const product = await Product.create({
      user: req.user._id,
      name,
      image,
      weight,
      expiryDate,
      price,
      category,
    });

    // increment productCount
    req.user.productCount = (req.user.productCount || 0) + 1;
    await req.user.save();

    res.status(201).json({ message: "Product added", product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Get single
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Update
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: "Not found" });

    const { name, image, weight, expiryDate, price, category } = req.body;
    if (category && !["Food","Non-Food"].includes(category)) return res.status(400).json({ message: "Invalid category" });

    product.name = name ?? product.name;
    product.image = image ?? product.image;
    product.weight = weight ?? product.weight;
    product.expiryDate = expiryDate ?? product.expiryDate;
    product.price = price ?? product.price;
    product.category = category ?? product.category;

    await product.save();
    res.json({ message: "Product updated", product });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// Delete
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!product) return res.status(404).json({ message: "Not found" });

    // decrement productCount
    req.user.productCount = Math.max(0, (req.user.productCount || 1) - 1);
    await req.user.save();

    res.json({ message: "Product deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
