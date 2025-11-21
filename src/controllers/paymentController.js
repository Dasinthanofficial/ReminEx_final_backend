import Stripe from "stripe";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import { getExchangeRate } from "../utils/currencyConverter.js"; // 👈 IMPORT THIS

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Currencies that do not support decimals (e.g. 100 JPY is 100, not 10000)
const ZERO_DECIMAL_CURRENCIES = [
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
];

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

  // Find the plan
  const plan = await Plan.findById(planId);
  const finalPlanName = plan ? plan.name : planName;

  // Calculate the actual amount paid for DB records
  const currency = session.currency.toUpperCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency);
  
  // Convert Stripe's integer amount back to a readable number
  // (e.g., 1000 cents -> 10.00 USD, but 1000 Yen -> 1000 JPY)
  const amountPaid = isZeroDecimal 
    ? session.amount_total 
    : session.amount_total / 100;

  // Calculate Expiry
  const daysToAdd = finalPlanName === "Monthly" ? 30 : 365;
  const planExpiry = new Date();
  planExpiry.setDate(planExpiry.getDate() + daysToAdd);

  // UPDATE USER DB
  user.plan = finalPlanName;
  user.planExpiry = planExpiry;
  await user.save();

  // CREATE SUBSCRIPTION RECORD
  const existingSub = await Subscription.findOne({ providerId: session.id });
  if (!existingSub) {
    await Subscription.create({
      user: user._id,
      plan: plan ? plan._id : null,
      amount: amountPaid,     // Store actual amount paid
      currency: currency,     // Store the currency used
      status: "active",
      startDate: new Date(),
      endDate: planExpiry,
      providerId: session.id,
    });
  }

  console.log(`✅ DB UPDATED: User ${user.email} is now on ${finalPlanName} (Paid ${amountPaid} ${currency})`);
};

// ✅ 2. Create Checkout Session
export const createCheckoutSession = async (req, res) => {
  try {
    const { planId, currency = 'USD' } = req.body; // 👈 Get currency from frontend
    
    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const targetCurrency = currency.toUpperCase();

    // 1. Get Dynamic Exchange Rate
    const rate = await getExchangeRate(targetCurrency);

    // 2. Convert Price (USD -> Target)
    const convertedAmount = plan.price * rate;

    // 3. Handle Stripe Logic (Zero-Decimal vs Standard)
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(targetCurrency);
    
    // Stripe requires integers. 
    // Standard: $10.00 = 1000 cents. 
    // Zero-Decimal: ¥1000 = 1000 units.
    const stripeAmount = isZeroDecimal 
      ? Math.round(convertedAmount) 
      : Math.round(convertedAmount * 100);

    // Ensure minimum charge amounts (Stripe requires ~$0.50 equivalent)
    if (stripeAmount < 50 && !isZeroDecimal) {
        return res.status(400).json({ message: "Amount too small to process with Stripe" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment", 
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: targetCurrency, // 👈 Use dynamic currency
            product_data: { 
              name: `${plan.name} Plan`,
              description: `Subscription for ${plan.name} Plan` 
            },
            unit_amount: stripeAmount, // 👈 Use calculated integer amount
          },
          quantity: 1,
        },
      ],
      metadata: {
        planId: plan._id.toString(),
        planName: plan.name,
        userId: req.user._id.toString(),
        currency: targetCurrency // 👈 Save currency in metadata for webhook
      },
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/plans`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Stripe Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ 3. Verify Payment Endpoint
export const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ message: "No session ID" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      await fulfillOrder(session);

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

// ✅ 4. Webhook
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