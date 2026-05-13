import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface DetectedChoice {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'choice' | 'text-response';
  isCorrect?: boolean;
}

export interface QuizQuestion {
  question: string;
  choices: { label: string; text: string; isCorrect: boolean }[];
}

export const detectAnswerChoices = async (imageData: string): Promise<DetectedChoice[]> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this worksheet image. You are an expert at identifying educational assessment markers. 
    Detect precisely:
    1. Multiple-choice markers like "a)", "b)", "A.", "1.", or "[ ]", circles, and checkbox boxes next to options.
    2. Answer fields like underline blanks "_______", clear empty boxes "☐", or distinct rectangular regions intended for student text entry.
    
    CRITICAL: Only identify markers that are functional parts of a test or worksheet structure. 
    - For multiple choice, target the marker itself (the letter or the bubble).
    - For text entry, target the entire line or box provided for the answer.
    - IGNORE body text, titles, decorative images, and watermark-like text.
    - If unsure if something is a marker, do NOT include it.
    
    For each detection, provide:
    - label: String. The text associated with the marker (e.g. "a", "b", "c", "d" or "Question 1"). If it's a blank box with no label, leave as empty string.
    - x, y: Number. Normalized coordinates (0 to 1) for the EXACT center of the detected marker or text area.
    - width, height: Number. Normalized width and height (0 to 1) of the detected marker or text field area. Use the actual dimensions of the box or line.
    - type: String. "choice" for bubbles/letters/boxes to be clicked, or "text-response" for lines/areas to be typed in.
    - isCorrect: Boolean. Only mark as true if there is a CLEAR visual indicator (circle, check, bold, etc.) that this is the correct answer. Default to false.
    
    Return as a JSON array sorted from top-to-bottom, left-to-right.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: imageData.split(',')[1], mimeType: "image/png" } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
            width: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
            type: { type: Type.STRING, enum: ["choice", "text-response"] },
            isCorrect: { type: Type.BOOLEAN }
          },
          required: ["label", "x", "y", "width", "height", "type"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Error parsing Gemini response:", e);
    return [];
  }
};

export const generateQuizItems = async (
  materialTitle: string, 
  numQuestions: number, 
  numOptions: number,
  type: 'multiple-choice' | 'true-false' | 'text'
): Promise<QuizQuestion[]> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Create a quiz based on the topic: "${materialTitle}".
    Generate ${numQuestions} questions.
    Each question should be of type: ${type}.
    If multiple choice, provide ${numOptions} options per question.
    Ensure one answer is marked as correct.
    
    Return the result as a JSON array of objects with "question" and "choices" (where each choice has "label", "text", and "isCorrect").
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            choices: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  text: { type: Type.STRING },
                  isCorrect: { type: Type.BOOLEAN }
                },
                required: ["label", "text", "isCorrect"]
              }
            }
          },
          required: ["question", "choices"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Error parsing Gemini response:", e);
    return [];
  }
};
