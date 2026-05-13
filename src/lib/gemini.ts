import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: (process.env.AI_API_KEY || process.env.GEMINI_API_KEY) as string });

export const extractJSON = (text: string | null | undefined): any => {
  if (!text) return null;
  try {
    // Attempt 1: Direct parse
    return JSON.parse(text);
  } catch (e) {
    try {
      // Attempt 2: Strip markdown blocks
      const cleaned = text.replace(/```json\n?|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e2) {
      try {
        // Attempt 3: Regex extract
        const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch (e3) {
        console.error("All JSON parsing attempts failed:", e3);
      }
    }
  }
  return null;
};

export const callGemini = async (prompt: string, config?: any, modelName: string = "gemini-1.5-flash", image?: string) => {
  try {
    const contents: any[] = [{ role: "user", parts: [{ text: prompt }] }];
    if (image) {
      contents[0].parts.unshift({ inlineData: { data: image.split(',')[1], mimeType: "image/png" } });
    }

    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, config, model: modelName })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown API error" }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
