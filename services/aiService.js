// services/aiService.js
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const analyzeSentimentAndIntent = async (message) => {
  if (!message) {
    return {
      sentiment: "neutral",
      intent: "general",
      recommendation: "Ask the user how you can help."
    };
  }

  try {
    const prompt = `
You are an AI assistant analyzing customer chat messages.
Extract THREE things only:

1. sentiment → "positive", "neutral", or "negative"
2. intent → one of ["track_order", "return_order", "stock_check", "general"]
3. recommendation → ONE helpful suggestion for the operator

Message: "${message}"

Output JSON only, like this:
{
  "sentiment": "",
  "intent": "",
  "recommendation": ""
}
`;

    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    let text = response.choices[0]?.message?.content || "{}";
    let json;

    try {
      json = JSON.parse(text);
    } catch {
      json = {
        sentiment: "neutral",
        intent: "general",
        recommendation: "Be polite and assist the user."
      };
    }


    return json;
  } catch (err) {
    console.error("Groq AI error:", err.message);
    return {
      sentiment: "neutral",
      intent: "general",
      recommendation: "AI unavailable. Follow normal support tone."
    };
  }
};
