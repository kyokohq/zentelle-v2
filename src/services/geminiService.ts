import { Type } from "@google/genai";
import { callGemini, extractJSON } from "../lib/gemini";

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
    - label: String. The text label (e.g. "a", "A.", "1.", "Choose...").
    - x, y: Number. Normalized coordinates (0 to 1) for the EXACT center of the marker or target area.
    - width, height: Number. Normalized width and height (0 to 1). 
      - For multiple choice bubbles/letters: These should be VERY TIGHT around the marker (e.g., 0.02 to 0.04).
      - For text response areas: These should cover the blank line or box (e.g., width 0.1 to 0.3, height 0.02 to 0.04).
      - CRITICAL: Do NOT include the question text or other nearby options in the dimensions. 
    - type: String. "choice" for bubbles/letters/boxes to be clicked, or "text-response" for lines/areas to be typed in.
    - isCorrect: Boolean. Only mark as true if there is a CLEAR visual indicator (circle, check, bold, etc.) that this is the correct answer. Default to false.
    
    Return as a JSON array sorted from top-to-bottom, left-to-right.
  `;

  try {
    const response = await callGemini(prompt, {
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
    }, "gemini-3-flash-preview", imageData);

    return extractJSON(response.text) || [];
  } catch (e: any) {
    console.error("Gemini Error (detectAnswerChoices):", e);
    throw e;
  }
};

export const generateQuizItems = async (
  materialTitle: string, 
  numQuestions: number, 
  numOptions: number,
  type: 'multiple-choice' | 'true-false' | 'text'
): Promise<QuizQuestion[]> => {
  const prompt = `
    Create a quiz based on the topic: "${materialTitle}".
    Generate ${numQuestions} questions.
    Each question should be of type: ${type}.
    If multiple choice, provide ${numOptions} options per question.
    Ensure one answer is marked as correct.
    
    Return the result as a JSON array of objects with "question" and "choices" (where each choice has "label", "text", and "isCorrect").
  `;

  try {
    const response = await callGemini(prompt, {
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
    });

    return extractJSON(response.text) || [];
  } catch (e: any) {
    console.error("Gemini Error (generateQuizItems):", e);
    throw e;
  }
};
