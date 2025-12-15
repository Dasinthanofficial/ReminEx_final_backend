import Plan from "../models/Plan.js";

// small helper to normalize plan payload (optional but helpful)
const normalizePlanBody = (body = {}) => {
  const cleaned = { ...body };

  // Trim strings
  if (typeof cleaned.name === "string") cleaned.name = cleaned.name.trim();
  if (typeof cleaned.description === "string") cleaned.description = cleaned.description.trim();

  // Clean features array
  if (Array.isArray(cleaned.features)) {
    cleaned.features = cleaned.features
      .map((f) => (typeof f === "string" ? f.trim() : ""))
      .filter(Boolean);
  }

  return cleaned;
};

const handlePlanError = (res, error) => {
  // Duplicate key (unique index) error
  if (error?.code === 11000) {
    return res.status(400).json({
      message: "A plan with this name already exists (Free/Monthly/Yearly must be unique).",
    });
  }

  // Mongoose validation error
  if (error?.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  }

  return res.status(500).json({ message: error.message || "Server error" });
};

// ✅ Create new plan
export const createPlan = async (req, res) => {
  try {
    const data = normalizePlanBody(req.body);
    const plan = await Plan.create(data);
    return res.status(201).json(plan);
  } catch (error) {
    return handlePlanError(res, error);
  }
};

// ✅ Get all plans
export const getPlans = async (req, res) => {
  try {
    // nice predictable order
    const plans = await Plan.find().sort({ price: 1, name: 1 });
    return res.json(plans);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Update plan
export const updatePlan = async (req, res) => {
  try {
    const data = normalizePlanBody(req.body);

    const plan = await Plan.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true, // ✅ IMPORTANT
    });

    if (!plan) return res.status(404).json({ message: "Plan not found" });
    return res.json(plan);
  } catch (error) {
    return handlePlanError(res, error);
  }
};

// ✅ Delete plan


export const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    return res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};