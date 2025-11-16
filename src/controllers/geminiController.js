// import { GoogleGenerativeAI } from "@google/generative-ai";
// import Product from "../models/Product.js";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// /**
//  * Get AI recipe suggestions based on user's expiring products
//  * Premium feature only
//  */
// export const getRecipeSuggestion = async (req, res) => {
//   try {
//     const userId = req.user._id;
    
//     // ✅ Automatically fetch products expiring in next 7 days
//     const sevenDaysFromNow = new Date();
//     sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
//     const expiringProducts = await Product.find({
//       user: userId,
//       category: "Food", // Only food products for recipes
//       expiryDate: { 
//         $gte: new Date(), // Not already expired
//         $lte: sevenDaysFromNow // Expires within 7 days
//       }
//     }).limit(10); // Limit to 10 products to avoid token limits
    
//     if (expiringProducts.length === 0) {
//       return res.status(404).json({ 
//         message: "No food products expiring soon. Add some products to get recipe suggestions!",
//         suggestion: "Try adding food items with expiry dates within the next 7 days."
//       });
//     }
    
//     // Extract product names
//     const productNames = expiringProducts.map(p => p.name).join(", ");
//     const expiryDates = expiringProducts.map(p => 
//       `${p.name} (expires ${p.expiryDate.toDateString()})`
//     ).join("\n");
    
//     // ✅ Generate recipe using Gemini AI
//     const model = genAI.getGenerativeModel({ model: "gemini-pro" });
//     const prompt = `You are a helpful cooking assistant. I have these ingredients that are expiring soon:

// ${expiryDates}

// Please suggest a simple, delicious recipe that uses as many of these ingredients as possible. Include:
// 1. Recipe name
// 2. Ingredients list (with quantities)
// 3. Step-by-step cooking instructions
// 4. Estimated cooking time

// Make it practical and easy to follow!`;
    
//     const result = await model.generateContent(prompt);
//     const aiText = result.response.text();
    
//     res.json({
//       success: true,
//       expiringProducts: expiringProducts.map(p => ({
//         id: p._id,
//         name: p.name,
//         expiryDate: p.expiryDate,
//         daysUntilExpiry: Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
//       })),
//       recipe: aiText,
//       message: `Recipe suggestion based on ${expiringProducts.length} expiring product(s)`
//     });
    
//   } catch (error) {
//     console.error("Gemini API Error:", error);
    
//     if (error.message?.includes("API key")) {
//       return res.status(500).json({ 
//         message: "AI service configuration error. Please contact support." 
//       });
//     }
    
//     res.status(500).json({ 
//       message: "Failed to generate recipe suggestion. Please try again later.",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

import { GoogleGenerativeAI } from "@google/generative-ai";
import Product from "../models/Product.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getRecipeSuggestion = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣  Fetch food products expiring within 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const expiringProducts = await Product.find({
      user: userId,
      category: "Food",
      expiryDate: { $gte: now, $lte: sevenDaysFromNow },
    }).limit(10);

    if (expiringProducts.length === 0) {
      return res.status(404).json({
        message:
          "No food products expiring soon. Add items with expiry dates within the next 7 days.",
      });
    }

    // 2️⃣  Build prompt
    const expiryList = expiringProducts
      .map((p) => `${p.name} (expires ${p.expiryDate.toDateString()})`)
      .join("\n");

    const prompt = `
You are a friendly cooking assistant. I have these ingredients expiring soon:

${expiryList}

Create one simple, delicious recipe that uses as many of these as possible.
Include:
1. A recipe name
2. Ingredients list with quantities
3. Step-by-step instructions
4. Total cooking time
Make it easy and realistic!
`;

    // 3️⃣  Call Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    // 4️⃣  Respond
    res.json({
      success: true,
      recipe: text,
      expiringProducts: expiringProducts.map((p) => ({
        id: p._id,
        name: p.name,
        expiryDate: p.expiryDate,
        daysUntilExpiry: Math.ceil(
          (new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24)
        ),
      })),
      message: `Recipe suggestion based on ${expiringProducts.length} expiring product(s)`,
    });
  } catch (error) {
    console.error("Gemini API Error:", error);

    if (error.message?.includes("API key")) {
      return res.status(500).json({
        message:
          "AI service configuration error. Check your GEMINI_API_KEY in .env.",
      });
    }

    res.status(500).json({
      message:
        "Failed to generate recipe suggestion. Please try again later.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
