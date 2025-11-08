// import User from "../models/User.js";
// import generateToken from "../utils/generateToken.js";
// import sendEmail from "../utils/sendEmail.js";
// import crypto from "crypto";

// // Register
// export const register = async (req, res) => {
//   const { name, email, password } = req.body;
//   const exists = await User.findOne({ email });
//   if (exists) return res.status(400).json({ message: "Email already registered" });

//   const user = await User.create({ name, email, password });
//   const token = generateToken(user._id);
//   res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, plan: user.plan } });
// };

// // Login
// export const login = async (req, res) => {
//   const { email, password } = req.body;
//   const user = await User.findOne({ email });
//   if (!user) return res.status(404).json({ message: "User not found" });

//   const match = await user.matchPassword(password);
//   if (!match) return res.status(401).json({ message: "Invalid credentials" });

//   const token = generateToken(user._id);
//   res.json({ token, user: { id: user._id, name: user.name, email: user.email, plan: user.plan } });
// };

// // Forgot Password - send OTP
// export const forgotPassword = async (req, res) => {
//   const { email } = req.body;
//   const user = await User.findOne({ email });
//   if (!user) return res.status(404).json({ message: "User not found" });

//   const otp = crypto.randomInt(100000, 999999).toString();
//   user.otp = otp;
//   user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 min
//   await user.save();

//   await sendEmail(email, "Your OTP", `Your OTP: ${otp}`);
//   res.json({ message: "OTP sent" });
// };

// // Reset Password
// export const resetPassword = async (req, res) => {
//   const { email, otp, newPassword } = req.body;
//   const user = await User.findOne({ email, otp, otpExpires: { $gt: Date.now() } });
//   if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

//   user.password = newPassword;
//   user.otp = undefined;
//   user.otpExpires = undefined;
//   await user.save();

//   res.json({ message: "Password reset successful" });
// };

import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// ---------------------- REGISTER ----------------------
export const register = async (req, res) => {
  try {
    const { name, email, password, role, adminSecret } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already registered" });

    // Determine role safely
    let newRole = "user"; // default
    if (role === "admin") {
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ message: "Cannot register as admin" });
      }
      newRole = "admin";
    }

    const user = await User.create({
      name,
      email,
      password,
      role: newRole
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      message: "Registered successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, plan: user.plan }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------- LOGIN ----------------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user._id, user.role);

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, plan: user.plan }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------- FORGOT PASSWORD ----------------------
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    await sendEmail(email, "Your OTP", `Your OTP: ${otp}`);
    res.json({ message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------- RESET PASSWORD ----------------------
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email, otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
