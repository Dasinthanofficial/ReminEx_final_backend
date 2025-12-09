import express from "express";
import { register, login, forgotPassword, resetPassword } from "../controllers/authController.js";

import { 
  validateRegister, 
  validateLogin, 
  validateForgotPassword, 
  validateResetPassword 
} from "../middleware/validators.js";
import { googleSignIn } from "../controllers/googleAuthController.js";

const router = express.Router();

// ✅ Registration - rate limited and validated
router.post("/register", validateRegister, register);

// ✅ Login - rate limited and validated
router.post("/login",validateLogin, login);

// ✅ Forgot password - strict rate limit (3 per hour)
router.post("/forgot-password",  validateForgotPassword, forgotPassword);

// ✅ Reset password - strict rate limit (3 per hour)
router.post("/reset-password",  validateResetPassword, resetPassword);

router.post("/google", googleSignIn);

export default router;

