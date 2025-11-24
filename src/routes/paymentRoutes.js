import express from "express";
import {
  createCheckoutSession,
  cancelSubscription,
  verifyPayment,
  stripeWebhook
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Webhook MUST use raw body (correct location)
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// User payment routes (JSON body)
router.post("/checkout", protect, createCheckoutSession);
router.get("/verify", protect, verifyPayment);
router.post("/cancel", protect, cancelSubscription);

export default router;
