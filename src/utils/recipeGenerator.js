import { callOpenRouter } from "./openRouterClient.js";

// local date key (avoids UTC shifting)
export const toDateKeyLocal = (d) => {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const cleanRecipeText = (raw) => {
  if (!raw) return "";
  const markers = ["🍽️ Dish Name:", "Dish Name:", "🧂 Ingredients:", "👨‍🍳 Instructions:"];
  let pos = Infinity;
  for (const m of markers) {
    const idx = raw.indexOf(m);
    if (idx !== -1 && idx < pos) pos = idx;
  }
  return pos !== Infinity ? raw.slice(pos).trim() : raw.trim();
};

export const buildRecipePrompt = (productName, expiryDate) => {
  const expStr = new Date(expiryDate).toDateString();

  return `
You are a fun, friendly home cook helping someone reduce food waste by using ingredients that are close to their expiry date.

Write ONE short, realistic recipe in friendly, natural English that uses *${productName}* as a key ingredient (expiring on ${expStr}).

Tone:
- Light and playful.
- Add 1–2 small, funny comments in the instructions.
- Recipe first, jokes second.

Output using EXACTLY:

🍽️ Dish Name: <simple, appealing name>
🧂 Ingredients:
• <ingredient 1>
• <ingredient 2>
• <ingredient 3>
👨‍🍳 Instructions:
1. <step 1>
2. <step 2>
3. <step 3>
🕒 Total Time: <number> minutes

Constraints:
- Under 150 words.
- Easy for beginners.
- Use common home ingredients.
- Do NOT mention expiry dates or being AI.
- Respond ONLY with the final recipe in that format.
`;
};

export const generateRecipeText = async (productName, expiryDate) => {
  const prompt = buildRecipePrompt(productName, expiryDate);
  const raw = await callOpenRouter(prompt);
  return cleanRecipeText(raw);
};