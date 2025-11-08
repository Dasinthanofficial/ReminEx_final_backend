import express from "express";
import { createCheckoutSession, stripeWebhook } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();

router.post("/checkout", protect, createCheckoutSession);

// Webhook (Stripe calls this, no auth)
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

export default router;
