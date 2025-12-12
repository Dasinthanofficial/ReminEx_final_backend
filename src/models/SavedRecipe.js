import mongoose from "mongoose";

const savedRecipeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, 
    productName: { type: String, required: true },
    recipeText: { type: String, required: true },
    expiryDate: { type: Date }, 
  },
  { timestamps: true }
);

export default mongoose.model("SavedRecipe", savedRecipeSchema);