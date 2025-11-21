import Stripe from "stripe";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ 1. Reusable Logic to Update Database
const fulfillOrder = async (session) => {
  console.log("🔄 Fulfilling order for session:", session.id);
  
  const { userId, planId, planName } = session.metadata || {};

  if (!userId || !planId) {
    console.error("❌ Missing metadata in session");
    return;
  }

  const user = await User.findById(userId);
  if (!user) return;

  // Find the plan (or fallback to metadata name)
  const plan = await Plan.findById(planId);
  const finalPlanName = plan ? plan.name : planName;
  const price = plan ? plan.price : (session.amount_total / 100);

  // Calculate Expiry
  const daysToAdd = finalPlanName === "Monthly" ? 30 : 365;
  const planExpiry = new Date();
  planExpiry.setDate(planExpiry.getDate() + daysToAdd);

  // UPDATE USER DB
  user.plan = finalPlanName;
  user.planExpiry = planExpiry;
  await user.save();

  // CREATE SUBSCRIPTION RECORD (Check for duplicates first)
  const existingSub = await Subscription.findOne({ providerId: session.id });
  if (!existingSub) {
    await Subscription.create({
      user: user._id,
      plan: plan ? plan._id : null,
      amount: price,
      status: "active",
      startDate: new Date(),
      endDate: planExpiry,
      providerId: session.id, // Using session ID as unique reference
    });
  }

  console.log(`✅ DB UPDATED: User ${user.email} is now on ${finalPlanName}`);
};

// ✅ 2. Create Checkout Session
export const createCheckoutSession = async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment", // Use 'payment' for one-time or 'subscription' for recurring
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: plan.name },
            unit_amount: Math.round(plan.price * 100),
          },
          quantity: 1,
        },
      ],
      // CRITICAL: Save info here so we can retrieve it later
      metadata: {
        planId: plan._id.toString(),
        planName: plan.name,
        userId: req.user._id.toString(),
      },
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/plans`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ 3. Verify Payment Endpoint (Called by Frontend)
export const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ message: "No session ID" });

    // Retrieve the session from Stripe to check status
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      // FORCE DB UPDATE HERE (Backup for Webhook)
      await fulfillOrder(session);

      // Return fresh user data
      const updatedUser = await User.findById(req.user._id);
      
      return res.json({
        success: true,
        plan: updatedUser.plan,
        planExpiry: updatedUser.planExpiry,
      });
    } else {
      return res.json({ success: false, message: "Payment not paid" });
    }
  } catch (error) {
    console.error("Verify Error:", error);
    res.status(500).json({ message: "Verification failed" });
  }
};

// ✅ 4. Webhook (Optional for Localhost, Required for Production)
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    await fulfillOrder(event.data.object);
  }

  res.json({ received: true });
};