import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Free / Monthly / Yearly
  price: { type: Number, required: true },
  description: { type: String },
  features: [{ type: String }],
});

export default mongoose.model("Plan", planSchema);
