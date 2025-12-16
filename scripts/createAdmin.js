// scripts/createAdmin.js (or whatever your filename is)
import mongoose from "mongoose";
import User from "../src/models/User.js";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not set in .env");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, (ans) => resolve(ans.trim())));

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("═══════════════════════════════════════");
    console.log("      CREATE ADMIN / SUPERADMIN");
    console.log("═══════════════════════════════════════\n");

    const name = await question("Enter name: ");
    const email = await question("Enter email: ");
    const password = await question("Enter password (min 6 chars): ");
    const roleInput = await question(
      "Enter role (admin/superadmin) [admin]: "
    );

    // ----- Validation -----
    if (!name || !email || !password) {
      console.log("\n❌ All fields (name, email, password) are required!");
      return;
    }

    if (password.length < 6) {
      console.log("\n❌ Password must be at least 6 characters!");
      return;
    }

    let role = "admin";
    const r = roleInput.toLowerCase();
    if (r === "superadmin") {
      role = "superadmin";
    } else if (r && r !== "admin") {
      console.log('\n❌ Invalid role. Use "admin" or "superadmin".');
      return;
    }

    // Check if user already exists
    const exists = await User.findOne({ email });
    if (exists) {
      console.log("\n❌ User with this email already exists!");
      console.log(`   Existing role: ${exists.role}`);
      return;
    }

    // Create user
    const created = await User.create({
      name,
      email,
      password,
      role,
    });

    console.log("\n═══════════════════════════════════════");
    console.log("✅ USER CREATED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════");
    console.log(`Name:  ${created.name}`);
    console.log(`Email: ${created.email}`);
    console.log(`Role:  ${created.role}`);
    console.log(`ID:    ${created._id}`);
    console.log("═══════════════════════════════════════\n");
    console.log("⚠️  IMPORTANT SECURITY NOTES:");
    console.log("   1. Store these credentials securely");
    console.log("   2. Change the password after first login");
    console.log("   3. Never share admin/superadmin credentials");
    console.log("   4. Enable 2FA if available\n");
  } catch (err) {
    console.error("\n❌ Error creating user:", err.message);
  } finally {
    rl.close();
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  }
};

createAdmin();