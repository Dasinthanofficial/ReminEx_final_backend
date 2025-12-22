import Stripe from "stripe";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import { getExchangeRate } from "../utils/currencyConverter.js";
import sendEmail from "../utils/sendEmail.js";

// Currencies without decimals
const ZERO_DECIMAL_CURRENCIES = [
  "BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF",
  "UGX","VND","VUV","XAF","XOF","XPF"
];

// ✅ Lazy Stripe init
let stripeClient = null;

const getStripe = () => {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
    err.statusCode = 500;
    throw err;
  }

  stripeClient = new Stripe(key);
  return stripeClient;
};

const requireStripeConfigured = (res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      message:
        "Stripe is not configured on the server. Please set STRIPE_SECRET_KEY in environment variables.",
    });
  }
  return null;
};

// ✅ robust client url resolver
const normalizeUrl = (u) => String(u || "").trim().replace(/\/+$/, "");
const getClientUrl = () => {
  const direct = normalizeUrl(process.env.CLIENT_URL);
  if (direct) return direct;

  const list = String(process.env.CLIENT_URLS || "")
    .split(",")
    .map(normalizeUrl)
    .filter(Boolean);

  return list[0] || "";
};

const fulfillOrder = async (session) => {
  try {
    console.log("🔄 Fulfilling order for session:", session.id);

    const { userId, planId, planName } = session.metadata || {};
    if (!userId || !planId) {
      console.error("❌ Missing metadata in Stripe session:", session.metadata);
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error("❌ User not found for id:", userId);
      return;
    }

    // Idempotency check
    const existing = await Subscription.findOne({ providerId: session.id });
    if (existing) {
      console.log("⚠️ Order already fulfilled. Skipping.");
      return;
    }

    const finalPlanName = planName || "Premium";

    const currency = (session.currency || "usd").toUpperCase();
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency);

    const amountPaid = isZeroDecimal
      ? (session.amount_total || 0)
      : (session.amount_total || 0) / 100;

    const durationDays = finalPlanName === "Yearly" ? 365 : 30;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + durationDays + 7);

    user.plan = finalPlanName;
    user.planExpiry = expiry;
    await user.save();

    let stripeSubId = null;
    if (typeof session.subscription === "string") stripeSubId = session.subscription;
    else if (session.subscription?.id) stripeSubId = session.subscription.id;

    await Subscription.create({
      user: user._id,
      plan: planId,
      amount: amountPaid,
      currency,
      status: "active",
      startDate: new Date(),
      endDate: expiry,
      providerId: session.id,
      subscriptionId: stripeSubId,
    });

    try {
      const subject = amountPaid === 0 ? "Your 7-Day Free Trial Started!" : "Payment Receipt";
      await sendEmail(user.email, subject, `Hi ${user.name}, your ${finalPlanName} plan is now active.`);
    } catch (emailErr) {
      console.error("⚠️ Email send failed:", emailErr?.message || emailErr);
    }

    console.log("✅ Order fulfilled successfully for", user.email);
  } catch (err) {
    console.error("❌ fulfillOrder Error:", err);
  }
};

// --------------------------------------------------
// CREATE CHECKOUT SESSION (WITH 7-DAY TRIAL)
// --------------------------------------------------
export const createCheckoutSession = async (req, res) => {
  try {
    const stripeMissing = requireStripeConfigured(res);
    if (stripeMissing) return stripeMissing;

    const clientUrl = getClientUrl();
    if (!clientUrl || !/^https?:\/\//i.test(clientUrl)) {
      return res.status(500).json({
        message:
          "CLIENT_URL is not configured correctly on the server. Set CLIENT_URL to your frontend URL (e.g. https://yourapp.vercel.app).",
      });
    }

    const stripe = getStripe();

    if (!req.user) return res.status(401).json({ message: "Login required" });

    const { planId, currency = "USD" } = req.body;
    if (!planId) return res.status(400).json({ message: "planId is required" });

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    if (plan.price <= 0 || plan.name === "Free") {
      return res.status(400).json({ message: "Free plan does not require payment." });
    }

    const targetCurrency = String(currency || "USD").toUpperCase();

    let rate;
    try {
      rate = await getExchangeRate(targetCurrency);
      if (!rate || typeof rate !== "number") throw new Error("Invalid exchange rate");
    } catch (exRateErr) {
      console.error("❌ Exchange rate error:", exRateErr?.message || exRateErr);
      return res.status(500).json({ message: "Failed to get exchange rate" });
    }

    const convertedAmount = plan.price * rate;
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(targetCurrency);
    const stripeAmount = isZeroDecimal ? Math.round(convertedAmount) : Math.round(convertedAmount * 100);

    if (stripeAmount < 50 && !isZeroDecimal) {
      return res.status(400).json({ message: `Amount too low to process in ${targetCurrency}` });
    }

    const interval = plan.name === "Yearly" ? "year" : "month";

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 7,
          metadata: { payingUserId: req.user._id.toString() },
        },
        customer_email: req.user.email,
        line_items: [
          {
            price_data: {
              currency: targetCurrency,
              product_data: {
                name: `${plan.name} Plan (7-Day Trial)`,
                description: "Cancel anytime before trial ends.",
              },
              unit_amount: stripeAmount,
              recurring: { interval },
            },
            quantity: 1,
          },
        ],
        metadata: {
          planId: plan._id.toString(),
          planName: plan.name,
          userId: req.user._id.toString(),
        },
        success_url: `${clientUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/plans`,
      });
    } catch (stripeErr) {
      console.error("🔥 STRIPE CHECKOUT ERROR:", stripeErr?.raw?.message || stripeErr?.message || stripeErr);
      return res.status(500).json({
        message: stripeErr?.raw?.message || stripeErr?.message || "Stripe checkout creation failed",
      });
    }

    if (!session?.url) {
      return res.status(500).json({
        message: "Failed to create checkout session (no URL returned by Stripe)",
      });
    }

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ Create Checkout Error:", err);
    return res.status(500).json({ message: err?.message || "Server error creating checkout session" });
  }
};

// --------------------------------------------------
// CANCEL SUBSCRIPTION
// --------------------------------------------------
export const cancelSubscription = async (req, res) => {
  try {
    const stripeMissing = requireStripeConfigured(res);
    if (stripeMissing) return stripeMissing;

    const stripe = getStripe();

    if (!req.user) return res.status(401).json({ message: "Login required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const sub = await Subscription.findOne({ user: user._id, status: "active" }).sort({ createdAt: -1 });
    if (!sub) return res.status(404).json({ message: "No active subscription" });

    let stripeSubId = sub.subscriptionId;

    if (!stripeSubId && sub.providerId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sub.providerId);
        if (session.subscription) {
          stripeSubId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        }
      } catch (e) {
        console.warn("Could not retrieve session for providerId:", sub.providerId, e?.message || e);
      }
    }

    if (stripeSubId) {
      try {
        await stripe.subscriptions.cancel(stripeSubId);
      } catch (stripeCancelErr) {
        console.error("⚠️ Stripe cancellation error:", stripeCancelErr?.message || stripeCancelErr);
      }
    }

    sub.status = "cancelled";
    await sub.save();

    user.plan = "Free";
    user.planExpiry = null;
    await user.save();

    try {
      await sendEmail(user.email, "Subscription Cancelled", "Your premium plan has been cancelled.");
    } catch (emailErr) {
      console.warn("Cancel email failed:", emailErr?.message || emailErr);
    }

    return res.json({ message: "Subscription cancelled" });
  } catch (err) {
    console.error("❌ Cancel Error:", err);
    return res.status(500).json({ message: "Failed to cancel subscription" });
  }
};

// --------------------------------------------------
// VERIFY PAYMENT
// --------------------------------------------------
export const verifyPayment = async (req, res) => {
  try {
    const stripeMissing = requireStripeConfigured(res);
    if (stripeMissing) return stripeMissing;

    const stripe = getStripe();

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Missing sessionId" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const ok =
      session.status === "complete" ||
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";

    if (ok) {
      await fulfillOrder(session);

      const user = await User.findById(req.user._id);
      return res.json({ success: true, plan: user.plan, planExpiry: user.planExpiry });
    }

    return res.json({ success: false });
  } catch (err) {
    console.error("❌ Verify Payment Error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Verification failed" });
  }
};

// --------------------------------------------------
// STRIPE WEBHOOK
// --------------------------------------------------
export const stripeWebhook = async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Stripe not configured");
  }

  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "Invalid signature"}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      await fulfillOrder(event.data.object);
    }
  } catch (e) {
    console.error("Error handling webhook event:", e);
  }

  return res.json({ received: true });
};