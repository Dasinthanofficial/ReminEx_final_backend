import express from "express";
import { register, login, forgotPassword, resetPassword } from "../controllers/authController.js";
import { authLimiter, sensitiveOpLimiter } from "../middleware/rateLimiter.js";
import { 
  validateRegister, 
  validateLogin, 
  validateForgotPassword, 
  validateResetPassword 
} from "../middleware/validators.js";

const router = express.Router();

// ✅ Registration - rate limited and validated
router.post("/register", authLimiter, validateRegister, register);

// ✅ Login - rate limited and validated
router.post("/login", authLimiter, validateLogin, login);

// ✅ Forgot password - strict rate limit (3 per hour)
router.post("/forgot-password", sensitiveOpLimiter, validateForgotPassword, forgotPassword);

// ✅ Reset password - strict rate limit (3 per hour)
router.post("/reset-password", sensitiveOpLimiter, validateResetPassword, resetPassword);

export default router;