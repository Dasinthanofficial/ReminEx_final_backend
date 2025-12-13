import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["Free", "Monthly", "Yearly"],
      unique: true,
      trim: true,
    },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: "" },
    features: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("Plan", planSchema);