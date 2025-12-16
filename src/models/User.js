import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin", "superadmin"], default: "user" },

    // Profile image
    avatar: {
      type: String,
      // TODO: replace this with your actual Cloudinary default avatar URL
      default:
        "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v1234567890/reminex/default_avatar.png",
    },

    // plan info
    plan: {
      type: String,
      enum: ["Free", "Monthly", "Yearly"],
      default: "Free",
    },
    planExpiry: { type: Date },
    planAuto: { type: Boolean, default: false },

    // tracking
    productCount: { type: Number, default: 0 },

    // OTP for forgot/reset
    otp: String,
    otpExpires: Date,

    // Google-related fields (optional)
    provider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String },
  },
  { timestamps: true }
);

// hash password
userSchema.pre("save", async function (next) {
  if (this.provider === "google" && !this.isModified("password")) {
    return next();
  }

  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model("User", userSchema);