import express from "express";
import {
  createCheckoutSession,
  cancelSubscription,
  verifyPayment,
  // ❌ do not import stripeWebhook for routing here
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();


// User payment routes (JSON body)
router.post("/checkout", protect, createCheckoutSession);
router.get("/verify", protect, verifyPayment);
router.post("/cancel", protect, cancelSubscription);

export default router;