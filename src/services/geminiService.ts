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
    Analyze this worksheet image. Detect:
    1. Answer choice markings such as "a)", "b)", "(1)", "[ ]", "A.", etc.
    2. Text entry areas such as blank lines (_______), empty boxes, or specific areas labeled for answers.
    
    For each detection, provide:
    - label: the label text (e.g. "a", "q1", or "" for just a box)
    - x, y: normalized coordinates (0-1) for the center of the detection.
    - type: must be either "choice" or "text-response".
    - isCorrect: (for "choice" only) if specifically marked as correct in the image.
    
    Return as a JSON array.
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
