export const checkPlanExpiry = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Skip if user is on Free plan (no expiry to check)
    if (user.plan === "Free") {
      return next();
    }

    // Check if plan has expired
    if (user.planExpiry && new Date() > new Date(user.planExpiry)) {
      console.log(`⏰ Plan expired for user ${user.email}. Downgrading to Free.`);
      
      // Downgrade to Free plan
      user.plan = "Free";
      user.planExpiry = null;
      await user.save();
      
      // Update req.user so controllers see the updated plan
      req.user = user;
    }

    next();
  } catch (err) {
    console.error("Error checking plan expiry:", err);
    // Don't block the request, just log and continue
    next();
  }
};


export const requirePremium = (req, res, next) => {
  const user = req.user;

  // Check if user has premium plan
  if (!["Monthly", "Yearly"].includes(user.plan)) {
    return res.status(403).json({ 
      message: "This feature requires a premium subscription. Please upgrade your plan.",
      currentPlan: user.plan,
      upgradeUrl: "/plans"
    });
  }

  next();
};