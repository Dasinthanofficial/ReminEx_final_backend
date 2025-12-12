import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;


const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

const OPENROUTER_REFERRER =
  process.env.OPENROUTER_REFERRER || "https://your-frontend-url.com";


export const callOpenRouter = async (prompt) => {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful cooking assistant. You may think privately, but in your final response you MUST NOT include any explanation, thoughts, or analysis. Only output the final recipe in the requested format.",
        },
        {
          role: "user",
          content: `${prompt}

IMPORTANT:
- Do NOT include your reasoning or preamble.
- Respond ONLY with the final recipe text in the requested format.`,
        },
      ],
      max_tokens: 512, // more room so the recipe isn't cut off
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERRER,
        "X-Title": "ReminEx AI Chef",
      },
      timeout: 40000,
    }
  );

  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No content returned from OpenRouter");
  return text.trim();
};