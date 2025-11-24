// // // import Stripe from "stripe";
// // // import Subscription from "../models/Subscription.js";
// // // import User from "../models/User.js";
// // // import Plan from "../models/Plan.js";
// // // import { getExchangeRate } from "../utils/currencyConverter.js"; // 👈 IMPORT THIS

// // // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// // // // Currencies that do not support decimals (e.g. 100 JPY is 100, not 10000)
// // // const ZERO_DECIMAL_CURRENCIES = [
// // //   "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
// // // ];

// // // // ✅ 1. Reusable Logic to Update Database
// // // const fulfillOrder = async (session) => {
// // //   console.log("🔄 Fulfilling order for session:", session.id);
  
// // //   const { userId, planId, planName } = session.metadata || {};

// // //   if (!userId || !planId) {
// // //     console.error("❌ Missing metadata in session");
// // //     return;
// // //   }

// // //   const user = await User.findById(userId);
// // //   if (!user) return;

// // //   // Find the plan
// // //   const plan = await Plan.findById(planId);
// // //   const finalPlanName = plan ? plan.name : planName;

// // //   // Calculate the actual amount paid for DB records
// // //   const currency = session.currency.toUpperCase();
// // //   const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency);
  
// // //   // Convert Stripe's integer amount back to a readable number
// // //   // (e.g., 1000 cents -> 10.00 USD, but 1000 Yen -> 1000 JPY)
// // //   const amountPaid = isZeroDecimal 
// // //     ? session.amount_total 
// // //     : session.amount_total / 100;

// // //   // Calculate Expiry
// // //   const daysToAdd = finalPlanName === "Monthly" ? 30 : 365;
// // //   const planExpiry = new Date();
// // //   planExpiry.setDate(planExpiry.getDate() + daysToAdd);

// // //   // UPDATE USER DB
// // //   user.plan = finalPlanName;
// // //   user.planExpiry = planExpiry;
// // //   await user.save();

// // //   // CREATE SUBSCRIPTION RECORD
// // //   const existingSub = await Subscription.findOne({ providerId: session.id });
// // //   if (!existingSub) {
// // //     await Subscription.create({
// // //       user: user._id,
// // //       plan: plan ? plan._id : null,
// // //       amount: amountPaid,     // Store actual amount paid
// // //       currency: currency,     // Store the currency used
// // //       status: "active",
// // //       startDate: new Date(),
// // //       endDate: planExpiry,
// // //       providerId: session.id,
// // //     });
// // //   }

// // //   console.log(`✅ DB UPDATED: User ${user.email} is now on ${finalPlanName} (Paid ${amountPaid} ${currency})`);
// // // };

// // // // ✅ 2. Create Checkout Session
// // // export const createCheckoutSession = async (req, res) => {
// // //   try {
// // //     const { planId, currency = 'USD' } = req.body; // 👈 Get currency from frontend
    
// // //     const plan = await Plan.findById(planId);
// // //     if (!plan) return res.status(404).json({ message: "Plan not found" });

// // //     const targetCurrency = currency.toUpperCase();

// // //     // 1. Get Dynamic Exchange Rate
// // //     const rate = await getExchangeRate(targetCurrency);

// // //     // 2. Convert Price (USD -> Target)
// // //     const convertedAmount = plan.price * rate;

// // //     // 3. Handle Stripe Logic (Zero-Decimal vs Standard)
// // //     const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(targetCurrency);
    
// // //     // Stripe requires integers. 
// // //     // Standard: $10.00 = 1000 cents. 
// // //     // Zero-Decimal: ¥1000 = 1000 units.
// // //     const stripeAmount = isZeroDecimal 
// // //       ? Math.round(convertedAmount) 
// // //       : Math.round(convertedAmount * 100);

// // //     // Ensure minimum charge amounts (Stripe requires ~$0.50 equivalent)
// // //     if (stripeAmount < 50 && !isZeroDecimal) {
// // //         return res.status(400).json({ message: "Amount too small to process with Stripe" });
// // //     }

// // //     const session = await stripe.checkout.sessions.create({
// // //       payment_method_types: ["card"],
// // //       mode: "payment", 
// // //       customer_email: req.user.email,
// // //       line_items: [
// // //         {
// // //           price_data: {
// // //             currency: targetCurrency, // 👈 Use dynamic currency
// // //             product_data: { 
// // //               name: `${plan.name} Plan`,
// // //               description: `Subscription for ${plan.name} Plan` 
// // //             },
// // //             unit_amount: stripeAmount, // 👈 Use calculated integer amount
// // //           },
// // //           quantity: 1,
// // //         },
// // //       ],
// // //       metadata: {
// // //         planId: plan._id.toString(),
// // //         planName: plan.name,
// // //         userId: req.user._id.toString(),
// // //         currency: targetCurrency // 👈 Save currency in metadata for webhook
// // //       },
// // //       success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
// // //       cancel_url: `${process.env.CLIENT_URL}/plans`,
// // //     });

// // //     res.json({ url: session.url, sessionId: session.id });
// // //   } catch (err) {
// // //     console.error("Stripe Error:", err);
// // //     res.status(500).json({ message: err.message });
// // //   }
// // // };

// // // // ✅ 3. Verify Payment Endpoint
// // // export const verifyPayment = async (req, res) => {
// // //   try {
// // //     const { sessionId } = req.query;
// // //     if (!sessionId) return res.status(400).json({ message: "No session ID" });

// // //     const session = await stripe.checkout.sessions.retrieve(sessionId);

// // //     if (session.payment_status === "paid") {
// // //       await fulfillOrder(session);

// // //       const updatedUser = await User.findById(req.user._id);
      
// // //       return res.json({
// // //         success: true,
// // //         plan: updatedUser.plan,
// // //         planExpiry: updatedUser.planExpiry,
// // //       });
// // //     } else {
// // //       return res.json({ success: false, message: "Payment not paid" });
// // //     }
// // //   } catch (error) {
// // //     console.error("Verify Error:", error);
// // //     res.status(500).json({ message: "Verification failed" });
// // //   }
// // // };

// // // // ✅ 4. Webhook
// // // export const stripeWebhook = async (req, res) => {
// // //   const sig = req.headers["stripe-signature"];
// // //   let event;

// // //   try {
// // //     event = stripe.webhooks.constructEvent(
// // //       req.body,
// // //       sig,
// // //       process.env.STRIPE_WEBHOOK_SECRET
// // //     );
// // //   } catch (err) {
// // //     return res.status(400).send(`Webhook Error: ${err.message}`);
// // //   }

// // //   if (event.type === "checkout.session.completed") {
// // //     await fulfillOrder(event.data.object);
// // //   }

// // //   res.json({ received: true });
// // // };

// // import Stripe from "stripe";
// // import Subscription from "../models/Subscription.js";
// // import User from "../models/User.js";
// // import Plan from "../models/Plan.js";
// // import { getExchangeRate } from "../utils/currencyConverter.js";
// // import sendEmail from "../utils/sendEmail.js"; // 👈 Import Email Utility

// // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// // const ZERO_DECIMAL_CURRENCIES = [
// //   "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
// // ];

// // // ✅ 1. Reusable Logic to Update Database AND Send Email
// // const fulfillOrder = async (session) => {
// //   console.log("🔄 Fulfilling order for session:", session.id);
  
// //   const { userId, planId, planName } = session.metadata || {};

// //   if (!userId || !planId) {
// //     console.error("❌ Missing metadata in session");
// //     return;
// //   }

// //   const user = await User.findById(userId);
// //   if (!user) return;

// //   const plan = await Plan.findById(planId);
// //   const finalPlanName = plan ? plan.name : planName;

// //   // Calculate Amount
// //   const currency = session.currency.toUpperCase();
// //   const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency);
// //   const amountPaid = isZeroDecimal ? session.amount_total : session.amount_total / 100;

// //   // Calculate Expiry
// //   const daysToAdd = finalPlanName === "Monthly" ? 30 : 365;
// //   const planExpiry = new Date();
// //   planExpiry.setDate(planExpiry.getDate() + daysToAdd);

// //   // UPDATE USER DB
// //   user.plan = finalPlanName;
// //   user.planExpiry = planExpiry;
// //   await user.save();

// //   // CREATE SUBSCRIPTION RECORD
// //   const existingSub = await Subscription.findOne({ providerId: session.id });
// //   if (!existingSub) {
// //     await Subscription.create({
// //       user: user._id,
// //       plan: plan ? plan._id : null,
// //       amount: amountPaid,
// //       currency: currency,
// //       status: "active",
// //       startDate: new Date(),
// //       endDate: planExpiry,
// //       providerId: session.id,
// //     });
// //   }

// //   console.log(`✅ DB UPDATED: User ${user.email} is now on ${finalPlanName}`);

// //   // 📧 SEND INVOICE EMAIL
// //   try {
// //     const invoiceHtml = `
// //       <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
// //         <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
// //           <h1 style="color: #38E07B; margin: 0;">Food Expiry Tracker</h1>
// //           <p style="color: #666;">Payment Receipt</p>
// //         </div>
        
// //         <div style="padding: 20px 0;">
// //           <p>Hi <strong>${user.name}</strong>,</p>
// //           <p>Thank you for your purchase! Your premium subscription is now active.</p>
          
// //           <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background: white; border-radius: 8px; overflow: hidden;">
// //             <tr style="background-color: #38E07B; color: #122017;">
// //               <th style="padding: 12px; text-align: left;">Description</th>
// //               <th style="padding: 12px; text-align: right;">Amount</th>
// //             </tr>
// //             <tr>
// //               <td style="padding: 12px; border-bottom: 1px solid #eee;">
// //                 <strong>${finalPlanName} Plan</strong><br>
// //                 <span style="font-size: 12px; color: #888;">Valid until ${planExpiry.toDateString()}</span>
// //               </td>
// //               <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
// //                 ${amountPaid.toFixed(2)} ${currency}
// //               </td>
// //             </tr>
// //             <tr>
// //               <td style="padding: 12px; text-align: right;"><strong>Total</strong></td>
// //               <td style="padding: 12px; text-align: right; font-weight: bold; color: #38E07B;">
// //                 ${amountPaid.toFixed(2)} ${currency}
// //               </td>
// //             </tr>
// //           </table>
// //         </div>

// //         <div style="text-align: center; font-size: 12px; color: #aaa; margin-top: 20px;">
// //           <p>Transaction ID: ${session.id}</p>
// //           <p>If you have any questions, reply to this email.</p>
// //         </div>
// //       </div>
// //     `;

// //     await sendEmail(
// //       user.email,
// //       "🧾 Your Payment Receipt - Food Expiry Tracker",
// //       `Thank you! You paid ${amountPaid} ${currency} for the ${finalPlanName} plan.`, // Fallback text
// //       invoiceHtml // HTML content
// //     );
// //     console.log(`📧 Invoice sent to ${user.email}`);
// //   } catch (emailErr) {
// //     console.error("❌ Failed to send invoice:", emailErr.message);
// //   }
// // };

// // // ✅ 2. Create Checkout Session
// // export const createCheckoutSession = async (req, res) => {
// //   try {
// //     const { planId, currency = 'USD' } = req.body;
    
// //     const plan = await Plan.findById(planId);
// //     if (!plan) return res.status(404).json({ message: "Plan not found" });

// //     const targetCurrency = currency.toUpperCase();
// //     const rate = await getExchangeRate(targetCurrency);
// //     const convertedAmount = plan.price * rate;
// //     const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(targetCurrency);
    
// //     const stripeAmount = isZeroDecimal 
// //       ? Math.round(convertedAmount) 
// //       : Math.round(convertedAmount * 100);

// //     if (stripeAmount < 50 && !isZeroDecimal) {
// //         return res.status(400).json({ message: "Amount too small to process with Stripe" });
// //     }

// //     const session = await stripe.checkout.sessions.create({
// //       payment_method_types: ["card"],
// //       mode: "payment", 
// //       customer_email: req.user.email,
// //       line_items: [
// //         {
// //           price_data: {
// //             currency: targetCurrency,
// //             product_data: { 
// //               name: `${plan.name} Plan`,
// //               description: `Subscription for ${plan.name} Plan` 
// //             },
// //             unit_amount: stripeAmount,
// //           },
// //           quantity: 1,
// //         },
// //       ],
// //       metadata: {
// //         planId: plan._id.toString(),
// //         planName: plan.name,
// //         userId: req.user._id.toString(),
// //         currency: targetCurrency
// //       },
// //       success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
// //       cancel_url: `${process.env.CLIENT_URL}/plans`,
// //     });

// //     res.json({ url: session.url, sessionId: session.id });
// //   } catch (err) {
// //     console.error("Stripe Error:", err);
// //     res.status(500).json({ message: err.message });
// //   }
// // };

// // // ✅ 3. Verify Payment Endpoint
// // export const verifyPayment = async (req, res) => {
// //   try {
// //     const { sessionId } = req.query;
// //     if (!sessionId) return res.status(400).json({ message: "No session ID" });

// //     const session = await stripe.checkout.sessions.retrieve(sessionId);

// //     if (session.payment_status === "paid") {
// //       await fulfillOrder(session); // Database update + Email send happens here

// //       const updatedUser = await User.findById(req.user._id);
      
// //       return res.json({
// //         success: true,
// //         plan: updatedUser.plan,
// //         planExpiry: updatedUser.planExpiry,
// //       });
// //     } else {
// //       return res.json({ success: false, message: "Payment not paid" });
// //     }
// //   } catch (error) {
// //     console.error("Verify Error:", error);
// //     res.status(500).json({ message: "Verification failed" });
// //   }
// // };

// // // ✅ 4. Webhook
// // export const stripeWebhook = async (req, res) => {
// //   const sig = req.headers["stripe-signature"];
// //   let event;

// //   try {
// //     event = stripe.webhooks.constructEvent(
// //       req.body,
// //       sig,
// //       process.env.STRIPE_WEBHOOK_SECRET
// //     );
// //   } catch (err) {
// //     return res.status(400).send(`Webhook Error: ${err.message}`);
// //   }

// //   if (event.type === "checkout.session.completed") {
// //     await fulfillOrder(event.data.object);
// //   }

// //   res.json({ received: true });
// // };



// import Stripe from "stripe";
// import Subscription from "../models/Subscription.js";
// import User from "../models/User.js";
// import Plan from "../models/Plan.js";
// import { getExchangeRate } from "../utils/currencyConverter.js";
// import sendEmail from "../utils/sendEmail.js";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// const ZERO_DECIMAL_CURRENCIES = [
//   "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
// ];

// // ✅ 1. Fulfill Order (Activates Plan)
// const fulfillOrder = async (session) => {
//   console.log("🔄 Fulfilling order:", session.id);
  
//   const { userId, planId, planName } = session.metadata || {};
//   if (!userId || !planId) return;

//   const user = await User.findById(userId);
//   if (!user) return;

//   const finalPlanName = planName || "Premium";
//   const isTrial = session.subscription_data?.trial_period_days > 0; // Check if trial
//   const amountPaid = session.amount_total / 100; 

//   // Set Expiry (30 days + 7 days trial)
//   const daysToAdd = finalPlanName === "Monthly" ? 30 : 365;
//   const planExpiry = new Date();
//   planExpiry.setDate(planExpiry.getDate() + daysToAdd + (isTrial ? 7 : 0));

//   user.plan = finalPlanName;
//   user.planExpiry = planExpiry;
//   await user.save();

//   // Save Subscription to DB
//   const existingSub = await Subscription.findOne({ providerId: session.id });
//   if (!existingSub) {
//     await Subscription.create({
//       user: user._id,
//       plan: planId,
//       amount: amountPaid,
//       currency: session.currency?.toUpperCase() || 'USD',
//       status: "active",
//       startDate: new Date(),
//       endDate: planExpiry,
//       providerId: session.id,
//     });
//   }

//   // Send Email
//   if (amountPaid === 0) {
//      await sendEmail(user.email, "🌟 7-Day Free Trial Started!", `Hi ${user.name}, your trial is active! You won't be charged for 7 days.`);
//   } else {
//      await sendEmail(user.email, "🧾 Payment Receipt", `Hi ${user.name}, payment received for ${finalPlanName}.`);
//   }
// };

// // ✅ 2. Create Checkout (WITH 7-DAY TRIAL)
// export const createCheckoutSession = async (req, res) => {
//   try {
//     const { planId, currency = 'USD' } = req.body;
//     const plan = await Plan.findById(planId);
//     if (!plan) return res.status(404).json({ message: "Plan not found" });

//     const targetCurrency = currency.toUpperCase();
//     const rate = await getExchangeRate(targetCurrency);
//     const convertedAmount = plan.price * rate;
//     const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(targetCurrency);
//     const stripeAmount = isZeroDecimal ? Math.round(convertedAmount) : Math.round(convertedAmount * 100);

//     // Define Interval
//     const interval = plan.name === "Yearly" ? "year" : "month";

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       mode: "subscription", // 👈 Must be subscription for trials
      
//       // 👇 THIS ENABLES THE 7-DAY FREE TRIAL
//       subscription_data: {
//         trial_period_days: 7,
//         metadata: { payingUserId: req.user._id.toString() }
//       },

//       customer_email: req.user.email,
//       line_items: [
//         {
//           price_data: {
//             currency: targetCurrency,
//             product_data: { 
//               name: `${plan.name} Plan (7-Day Free Trial)`,
//               description: "Cancel anytime before 7 days to avoid charges." 
//             },
//             unit_amount: stripeAmount,
//             recurring: { interval: interval },
//           },
//           quantity: 1,
//         },
//       ],
//       metadata: {
//         planId: plan._id.toString(),
//         planName: plan.name,
//         userId: req.user._id.toString(),
//       },
//       success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${process.env.CLIENT_URL}/plans`,
//     });

//     res.json({ url: session.url, sessionId: session.id });
//   } catch (err) {
//     console.error("Stripe Error:", err);
//     res.status(500).json({ message: err.message });
//   }
// };

// // ✅ 3. Cancel Subscription
// export const cancelSubscription = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id);
    
//     // 1. Find the active subscription in local DB
//     const sub = await Subscription.findOne({ user: user._id, status: "active" }).sort({ createdAt: -1 });

//     if (sub && sub.providerId) {
//       // 2. Retrieve Session from Stripe to get the real Subscription ID
//       const session = await stripe.checkout.sessions.retrieve(sub.providerId);
//       if (session.subscription) {
//         // 3. Cancel at Stripe (Immediately stops future charges)
//         await stripe.subscriptions.cancel(session.subscription);
//       }
      
//       sub.status = "cancelled";
//       await sub.save();
//     }

//     // 4. Downgrade User Logic
//     user.plan = "Free";
//     user.planExpiry = null;
//     await user.save();

//     await sendEmail(user.email, "Subscription Cancelled", "You have cancelled your premium plan. No further charges will be made.");

//     res.json({ message: "Subscription cancelled successfully." });
//   } catch (err) {
//     console.error("Cancel Error:", err);
//     res.status(500).json({ message: "Failed to cancel subscription" });
//   }
// };

// // ... Keep verifyPayment and stripeWebhook exactly as they were ...
// export const verifyPayment = async (req, res) => {
//   const { sessionId } = req.query;
//   const session = await stripe.checkout.sessions.retrieve(sessionId);
//   if (session.payment_status === "paid" || session.status === "complete") { // 'complete' for trials
//     await fulfillOrder(session);
//     const u = await User.findById(req.user._id);
//     return res.json({ success: true, plan: u.plan, planExpiry: u.planExpiry });
//   }
//   res.json({ success: false });
// };

// export const stripeWebhook = async (req, res) => {
//   const sig = req.headers["stripe-signature"];
//   let event;
//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
  
//   if (event.type === "checkout.session.completed") {
//     await fulfillOrder(event.data.object);
//   }
//   res.json({ received: true });
// };

import Stripe from "stripe";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Plan from "../models/Plan.js";
import { getExchangeRate } from "../utils/currencyConverter.js";
import sendEmail from "../utils/sendEmail.js";
import dotenv from "dotenv";

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Currencies without decimals
const ZERO_DECIMAL_CURRENCIES = [
  "BIF","CLP","DJF","GNF","JPY","KMF","KRW","MGA","PYG","RWF",
  "UGX","VND","VUV","XAF","XOF","XPF"
];

// --------------------------------------------------
// 1. FULFILL ORDER (CALLED AFTER PAYMENT SUCCESS)
// --------------------------------------------------
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

    // amount_total might be undefined for subscriptions during trial setup
    const amountPaid = (session.amount_total || 0) / 100;

    // Set expiry date: add billing duration and trial days if trial present
    const durationDays = finalPlanName === "Yearly" ? 365 : 30;
    // If event/session indicates trial, we still add 7 days to expiry (business logic)
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + durationDays + 7);

    // Update user
    user.plan = finalPlanName;
    user.planExpiry = expiry;
    await user.save();

    // Find Stripe subscription ID (sub_xxx) if available
    let stripeSubId = null;
    if (typeof session.subscription === "string") {
      stripeSubId = session.subscription;
    } else if (session.subscription?.id) {
      stripeSubId = session.subscription.id;
    }

    // Create Subscription Record
    await Subscription.create({
      user: user._id,
      plan: planId,
      amount: amountPaid,
      currency: (session.currency || "usd").toUpperCase(),
      status: "active",
      startDate: new Date(),
      endDate: expiry,
      providerId: session.id,
      subscriptionId: stripeSubId,
    });

    // Send email (best-effort)
    try {
      const subject = amountPaid === 0
        ? "🌟 Your 7-Day Free Trial Started!"
        : "🧾 Payment Receipt";

      await sendEmail(
        user.email,
        subject,
        `Hi ${user.name}, your ${finalPlanName} plan is now active.`
      );
    } catch (emailErr) {
      console.error("⚠️ Email send failed:", emailErr?.message || emailErr);
    }

    console.log("✅ Order fulfilled successfully for", user.email);
  } catch (err) {
    console.error("❌ fulfillOrder Error:", err);
  }
};

// --------------------------------------------------
// 2. CREATE CHECKOUT SESSION (WITH 7-DAY TRIAL)
// --------------------------------------------------
export const createCheckoutSession = async (req, res) => {
  try {
    // Auth guard
    if (!req.user) {
      return res.status(401).json({ message: "Login required" });
    }

    const { planId, currency = "USD" } = req.body;
    if (!planId) {
      return res.status(400).json({ message: "planId is required" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Prevent checkout for free plans
    if (plan.price <= 0 || plan.name === "Free") {
      return res.status(400).json({ message: "Free plan does not require payment." });
    }

    const targetCurrency = (currency || "USD").toUpperCase();

    // Exchange rate - guard against failures
    let rate;
    try {
      rate = await getExchangeRate(targetCurrency);
      if (!rate || typeof rate !== "number") {
        throw new Error("Invalid exchange rate");
      }
    } catch (exRateErr) {
      console.error("❌ Exchange rate error:", exRateErr?.message || exRateErr);
      return res.status(500).json({ message: "Failed to get exchange rate" });
    }

    const convertedAmount = plan.price * rate;
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(targetCurrency);
    const stripeAmount = isZeroDecimal ? Math.round(convertedAmount) : Math.round(convertedAmount * 100);

    // Minimum charge guard (Stripe requires a small minimum)
    if (stripeAmount < 50 && !isZeroDecimal) {
      return res.status(400).json({ message: `Amount too low to process in ${targetCurrency}` });
    }

    const interval = plan.name === "Yearly" ? "year" : "month";

    // Create Stripe checkout session — wrap in try/catch to capture Stripe error
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
        success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/plans`,
      });
    } catch (stripeErr) {
      // Log the full Stripe error and return its helpful message to frontend
      console.error("🔥 STRIPE CHECKOUT ERROR:", stripeErr?.raw?.message || stripeErr?.message || stripeErr);
      return res.status(500).json({ message: stripeErr?.raw?.message || stripeErr?.message || "Stripe checkout creation failed" });
    }

    // Ensure session.url exists before returning
    if (!session || !session.url) {
      console.error("❌ Stripe returned no session url:", session);
      return res.status(500).json({ message: "Failed to create checkout session (no URL returned by Stripe)" });
    }

    return res.json({ url: session.url, sessionId: session.id });

  } catch (err) {
    console.error("❌ Create Checkout Error:", err);
    return res.status(500).json({ message: err?.message || "Server error creating checkout session" });
  }
};

// --------------------------------------------------
// 3. CANCEL SUBSCRIPTION
// --------------------------------------------------
export const cancelSubscription = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Login required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const sub = await Subscription.findOne({ user: user._id, status: "active" }).sort({ createdAt: -1 });
    if (!sub) return res.status(404).json({ message: "No active subscription" });

    let stripeSubId = sub.subscriptionId;

    // If we only stored providerId (checkout session id), retrieve the session to find subscription id
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
// 4. VERIFY PAYMENT (AFTER REDIRECT FROM STRIPE)
// --------------------------------------------------
export const verifyPayment = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Login required" });

    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ success: false, message: "Missing sessionId" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // When session.status === 'complete' or payment_status === 'paid'
    if (session.payment_status === "paid" || session.status === "complete") {
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
// 5. STRIPE WEBHOOK
// IMPORTANT: make sure your webhook endpoint uses raw body parser in server.js (express.raw({type:'application/json'}))
// --------------------------------------------------
export const stripeWebhook = async (req, res) => {
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

  res.json({ received: true });
};
