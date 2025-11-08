import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },

  // plan info
  plan: { type: String, enum: ["Free", "Monthly", "Yearly"], default: "Free" },
  planExpiry: { type: Date }, // if purchased plan
  planAuto: { type: Boolean, default: false }, // not used here, but available

  // tracking
  productCount: { type: Number, default: 0 },

  // OTP for forgot/reset
  otp: String,
  otpExpires: Date,
}, { timestamps: true });

// hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model("User", userSchema);
