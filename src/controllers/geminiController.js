import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getRecipeSuggestion = async (req, res) => {
  try {
    const { productName } = req.body;

    if (!productName)
      return res.status(400).json({ message: "Product name is required" });

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Suggest a simple recipe using ${productName}. Include ingredients and short steps.`;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    res.json({
      success: true,
      product: productName,
      recipe: aiText,
    });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ message: "Failed to get recipe suggestion" });
  }
};
