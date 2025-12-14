import mongoose from "mongoose";

const recipeSuggestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    // Local-day key like "2025-12-14"
    expiryKey: { type: String, required: true },
    expiryDate: { type: Date, required: true },

    recipeText: { type: String, required: true },
    provider: { type: String, default: "openrouter" },
  },
  { timestamps: true }
);

// One recipe per user + product + expiryKey
recipeSuggestionSchema.index({ user: 1, product: 1, expiryKey: 1 }, { unique: true });

export default mongoose.model("RecipeSuggestion", recipeSuggestionSchema);