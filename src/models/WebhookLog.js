import mongoose from "mongoose";

const webhookLogSchema = new mongoose.Schema({
  eventType: String,
  eventId: String,
  payload: Object,
  status: { type: String, enum: ["success", "failed"], default: "success" },
  error: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("WebhookLog", webhookLogSchema);