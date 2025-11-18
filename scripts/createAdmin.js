import mongoose from "mongoose";
import User from "../src/models/User.js";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get admin details from user input
    console.log("═══════════════════════════════════════");
    console.log("   CREATE ADMIN USER");
    console.log("═══════════════════════════════════════\n");

    const adminName = await question("Enter admin name: ");
    const adminEmail = await question("Enter admin email: ");
    const adminPassword = await question("Enter admin password (min 6 chars): ");

    // Validate input
    if (!adminName || !adminEmail || !adminPassword) {
      console.log("\n❌ All fields are required!");
      process.exit(1);
    }

    if (adminPassword.length < 6) {
      console.log("\n❌ Password must be at least 6 characters!");
      process.exit(1);
    }

    // Check if admin already exists
    const exists = await User.findOne({ email: adminEmail });
    if (exists) {
      console.log("\n❌ User with this email already exists!");
      console.log(`   Role: ${exists.role}`);
      process.exit(1);
    }

    // Create admin user
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: "admin"
    });

    console.log("\n═══════════════════════════════════════");
    console.log("✅ ADMIN USER CREATED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════");
    console.log(`Name:  ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role:  ${admin.role}`);
    console.log(`ID:    ${admin._id}`);
    console.log("═══════════════════════════════════════\n");
    console.log("⚠️  IMPORTANT SECURITY NOTES:");
    console.log("   1. Store these credentials securely");
    console.log("   2. Change the password after first login");
    console.log("   3. Never share admin credentials");
    console.log("   4. Enable 2FA if available\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error creating admin:", err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
};

createAdmin();