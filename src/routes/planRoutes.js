// import express from "express";
// import { getPlans, createPlan, updatePlan } from "../controllers/planController.js";
// import { protect, adminOnly } from "../middleware/authMiddleware.js";

// const router = express.Router();

// // Anyone can view plans
// router.get("/", getPlans);

// // Admin only
// router.post("/", protect, adminOnly, createPlan);
// router.put("/:id", protect, adminOnly, updatePlan);

// export default router;


import express from "express";
import { createPlan, getPlans, updatePlan, deletePlan } from "../controllers/planController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getPlans);
router.post("/", protect, adminOnly, createPlan);
router.put("/:id", protect, adminOnly, updatePlan);
router.delete("/:id", protect, adminOnly, deletePlan);

export default router;



