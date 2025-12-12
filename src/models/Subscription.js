import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" }, // 👈 added
    status: {
      type: String,
      enum: ["active", "cancelled", "expired", "pending"],
      default: "active",
    },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    providerId: String,     
    subscriptionId: String, 
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);