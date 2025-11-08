import Stripe from "stripe";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe Checkout session
export const createCheckoutSession = async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: plan.name },
            unit_amount: plan.price * 100, // in cents
            recurring: { interval: plan.name.toLowerCase() === "monthly" ? "month" : "year" },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/payment-success`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Stripe session creation failed" });
  }
};

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const user = await User.findOne({ email: session.customer_email });
    const plan = await Plan.findOne({ name: session.display_items[0].custom.name });

    if (user && plan) {
      user.plan = plan.name;
      user.planExpiry = new Date(Date.now() + (plan.name === "Monthly" ? 30 : 365) * 24 * 60 * 60 * 1000);
      await user.save();

      await Subscription.create({
        user: user._id,
        plan: plan._id,
        amount: plan.price,
        status: "active",
        startDate: new Date(),
        endDate: user.planExpiry,
        providerId: session.id,
      });
    }
  }

  res.json({ received: true });
};
