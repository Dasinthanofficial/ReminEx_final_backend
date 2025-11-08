// import jwt from "jsonwebtoken";
// import User from "../models/User.js";

// export const protect = async (req, res, next) => {
//   const auth = req.headers.authorization;
//   if (!auth || !auth.startsWith("Bearer ")) return res.status(401).json({ message: "No token" });

//   const token = auth.split(" ")[1];
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(decoded.id).select("-password -otp -otpExpires");
//     if (!user) return res.status(401).json({ message: "User not found" });
//     req.user = user;
//     next();
//   } catch (err) {
//     return res.status(401).json({ message: "Token invalid" });
//   }
// };

// export const adminOnly = (req, res, next) => {
//   if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" });
//   next();
// };

// import Plan from "../models/Plan.js";

// // Create new plan
// export const createPlan = async (req, res) => {
//   try {
//     const plan = await Plan.create(req.body);
//     res.status(201).json(plan);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// // Get all plans
// export const getPlans = async (req, res) => {
//   try {
//     const plans = await Plan.find();
//     res.json(plans);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // Update a plan
// export const updatePlan = async (req, res) => {
//   try {
//     const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!plan) return res.status(404).json({ message: "Plan not found" });
//     res.json(plan);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// /** ❌ Delete a plan (Admin only) */
// export const deletePlan = async (req, res) => {
//   try {
//     const plan = await Plan.findByIdAndDelete(req.params.id);
//     if (!plan) return res.status(404).json({ message: "Plan not found" });
//     res.json({ message: "Plan deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };


import Plan from "../models/Plan.js";

// ✅ Create new plan
export const createPlan = async (req, res) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json(plan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✅ Get all plans
export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update plan
export const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Delete plan
export const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
