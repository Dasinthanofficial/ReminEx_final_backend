import mongoose from "mongoose";

const advertisementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String, required: true }, // stored file path
  link: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Advertisement", advertisementSchema);
