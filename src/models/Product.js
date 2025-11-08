// src/models/Product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  category: { type: String, enum: ["Food", "Non-Food"], required: true },
  weight: Number,
  price: Number,
  image: String,
  expiryDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Product", productSchema);
