import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface DetectedChoice {
  label: string;
  x: number;
  y: number;
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
    Detect:
    1. Multiple-choice markers like "a)", "b)", "A.", "(1)", "[ ]", circles, or checkboxes next to text.
    2. Answer fields like underline blanks "_______", empty boxes "☐", or rectangular regions intended for text entry.
    
    CRITICAL: Only identify markers that are clearly part of a test or worksheet structure. Avoid random text or decorative images.
    
    For each detection, provide:
    - label: String. The text label (e.g. "a", "b", "c", "d" or "q1"). If it's a blank box, leave as empty string or "blank".
    - x, y: Number. Normalized coordinates (0 to 1) for the EXACT center of the marker (e.g. the center of the checkbox or the letter 'a').
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
            type: { type: Type.STRING, enum: ["choice", "text-response"] },
            isCorrect: { type: Type.BOOLEAN }
          },
          required: ["label", "x", "y", "type"]
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
