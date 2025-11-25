import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name || email.split("@")[0];
    const picture = payload.picture;

    if (!email) {
      return res.status(400).json({ message: "Google account has no email" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        password: Math.random().toString(36).slice(-12) + "Aa1",
        role: "user",
        provider: "google",       // 👈 set provider
        googleId: payload.sub,    // 👈 set googleId
      });
      console.log(`✅ New Google user created: ${email}`);
    } else {
      console.log(`✅ Existing user logged in with Google: ${email}`);
    }

    const token = generateToken(user._id, user.role);

    res.json({
      message: "Google sign-in successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        planExpiry: user.planExpiry,
        avatar: picture,
      },
    });
  } catch (err) {
    console.error("Google sign-in error:", err);
    res.status(500).json({ message: "Failed to sign in with Google" });
  }
};