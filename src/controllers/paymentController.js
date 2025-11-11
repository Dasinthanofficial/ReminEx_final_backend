import Stripe from "stripe";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


// ✅ Create Stripe Checkout session
export const createCheckoutSession = async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      return res.status(400).json({ message: "Plan ID is required" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: plan.name,
              description: plan.description || `${plan.name} Subscription Plan`
            },
            unit_amount: plan.price * 100, // Convert to cents
            recurring: {
              interval: plan.name.toLowerCase() === "monthly" ? "month" : "year"
            },
          },
          quantity: 1,
        },
      ],
      // ✅ Store plan and user info in metadata
      metadata: {
        planId: plan._id.toString(),
        planName: plan.name,
        userId: req.user._id.toString()
      },
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
    });

    res.json({ 
      url: session.url,
      sessionId: session.id
    });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ 
      message: "Failed to create checkout session",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ✅ Stripe Webhook Handler
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  
  if (!sig) {
    console.error("❌ No Stripe signature found in headers");
    return res.status(400).send("No Stripe signature");
  }

  let event;

  try {
    // ✅ CRITICAL: Use req.body directly (it's raw buffer from express.raw)
    event = stripe.webhooks.constructEvent(
      req.body, // This is the raw buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log("✅ Webhook signature verified:", event.type);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle different event types
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case "customer.subscription.updated":
        console.log("Subscription updated:", event.data.object.id);
        // Handle subscription updates if needed
        break;
      
      case "customer.subscription.deleted":
        console.log("Subscription cancelled:", event.data.object.id);
        // Handle subscription cancellation if needed
        await handleSubscriptionCancelled(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Error processing webhook:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// ✅ Handle successful checkout
async function handleCheckoutCompleted(session) {
  console.log("Processing checkout.session.completed:", session.id);

  // Get plan and user info from metadata
  const { userId, planId, planName } = session.metadata;

  if (!userId || !planId) {
    console.error("Missing metadata in session:", session.id);
    return;
  }

  const user = await User.findById(userId);
  const plan = await Plan.findById(planId);

  if (!user) {
    console.error(`User not found: ${userId}`);
    return;
  }

  if (!plan) {
    console.error(`Plan not found: ${planId}`);
    return;
  }

  // Calculate plan expiry
  const daysToAdd = plan.name === "Monthly" ? 30 : 365;
  const planExpiry = new Date();
  planExpiry.setDate(planExpiry.getDate() + daysToAdd);

  // Update user's plan
  user.plan = plan.name;
  user.planExpiry = planExpiry;
  await user.save();

  // Create subscription record
  await Subscription.create({
    user: user._id,
    plan: plan._id,
    amount: plan.price,
    status: "active",
    startDate: new Date(),
    endDate: planExpiry,
    providerId: session.subscription, // Stripe subscription ID
  });

  console.log(`✅ User ${user.email} subscribed to ${plan.name} until ${planExpiry.toDateString()}`);
}

// ✅ Handle subscription cancellation
async function handleSubscriptionCancelled(subscription) {
  console.log("Processing subscription cancellation:", subscription.id);

  // Find the subscription in database
  const sub = await Subscription.findOne({ providerId: subscription.id });
  
  if (!sub) {
    console.error(`Subscription not found: ${subscription.id}`);
    return;
  }

  // Update subscription status
  sub.status = "cancelled";
  await sub.save();

  // Update user's plan back to Free
  const user = await User.findById(sub.user);
  if (user) {
    user.plan = "Free";
    user.planExpiry = null;
    await user.save();
    console.log(`✅ User ${user.email} downgraded to Free plan`);
  }
}