import express from "express";
import { createCheckoutSession, stripeWebhook } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Checkout session (protected - user must be logged in)
router.post("/checkout", protect, createCheckoutSession);

// ✅ Webhook route (NO auth, NO express.json - raw body already handled in server.js)
// Stripe will call this endpoint directly
router.post("/webhook", stripeWebhook);

export default router;