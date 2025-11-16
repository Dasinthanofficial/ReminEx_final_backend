// import express from "express";
// import { createCheckoutSession, stripeWebhook } from "../controllers/paymentController.js";
// import { protect } from "../middleware/authMiddleware.js";

// const router = express.Router();

// // ✅ Checkout session (protected - user must be logged in)
// router.post("/checkout", protect, createCheckoutSession);

// // ✅ Webhook route (NO auth, NO express.json - raw body already handled in server.js)
// // Stripe will call this endpoint directly
// router.post("/webhook", stripeWebhook);

// export default router;



// src/routes/paymentRoutes.js
import express from "express";
import { createCheckoutSession, stripeWebhook, verifyPayment } from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Checkout session (protected - user must be logged in)
router.post("/checkout", protect, createCheckoutSession);

// ✅ Verify payment (protected)
router.get("/verify", protect, verifyPayment);

// ✅ Webhook route (NO auth, NO express.json - raw body already handled in server.js)
router.post("/webhook", stripeWebhook);

export default router;