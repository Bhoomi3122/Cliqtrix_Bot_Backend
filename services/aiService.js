// services/aiService.js
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const analyzeSentimentAndIntent = async (message) => {
  // No user message → neutral, general
  if (!message || !String(message).trim()) {
    return {
      sentiment: "neutral",
      intent: "general",
      recommendation: "Ask the user how you can help."
    };
  }

  const prompt = `
You are an assistant analyzing a customer chat message.

Extract ONLY this JSON:

{
  "sentiment": "positive | neutral | negative",
  "intent": "track_order | return_order | cancel_order | stock_check | general",
  "recommendation": "one short helpful suggestion for the support agent"
}

Rules:
- Output ONLY valid JSON.
- No explanations.
- No extra text.

Message: "${message}"
`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    let raw = response.choices?.[0]?.message?.content || "{}";

    // Attempt to parse JSON normally
    try {
      return JSON.parse(raw);
    } catch {}

    // Fallback: extract JSON using regex
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}

    // Final fallback if parsing fails
    return {
      sentiment: "neutral",
      intent: "general",
      recommendation: "Assist the user based on their query."
    };

  } catch (err) {
    console.error("Groq AI error:", err.message);

    // AI completely unavailable
    return {
      sentiment: "neutral",
      intent: "general",
      recommendation: "AI unavailable. Respond politely based on the user's question."
    };
  }
};
