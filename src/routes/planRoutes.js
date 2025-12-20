// import express from "express";
// import { createPlan, getPlans, updatePlan, deletePlan } from "../controllers/planController.js";
// import { protect, adminOnly } from "../middleware/authMiddleware.js";
// import { validatePlan, validateMongoId } from "../middleware/validators.js";

// const router = express.Router();

// // ✅ Public route - anyone can view available plans
// router.get("/", getPlans);

// // ✅ Admin only routes - with validation
// router.post("/", protect, adminOnly, validatePlan, createPlan);
// router.put("/:id", protect, adminOnly, validateMongoId, validatePlan, updatePlan);
// router.delete("/:id", protect, adminOnly, validateMongoId, deletePlan);

// export default router;


import express from "express";
import { createPlan, getPlans, updatePlan, deletePlan } from "../controllers/planController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { validatePlan, validatePlanUpdate, validateMongoId } from "../middleware/validators.js";

const router = express.Router();

// ✅ Public route - anyone can view available plans
router.get("/", getPlans);

// ✅ Admin only routes - with validation
router.post("/", protect, adminOnly, validatePlan, createPlan);

// ✅ Update should NOT require `name`
router.put("/:id", protect, adminOnly, validateMongoId, validatePlanUpdate, updatePlan);

router.delete("/:id", protect, adminOnly, validateMongoId, deletePlan);

export default router;