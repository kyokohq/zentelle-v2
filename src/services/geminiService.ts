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
    Analyze this worksheet image. You are an expert at identifying educational assessment markers and student response areas.
    Detect all potential interaction points, including:
    1. Multiple-choice markers: "a)", "b)", "A.", "1.", "[ ]", empty circles, radio buttons, or checkbox boxes next to options.
    2. Answer fields: Underline blanks "_______", clear empty boxes "☐", or distinct rectangular regions/frames intended for student text or numerical entry.
    3. Selection areas: Words or phrases that are clearly intended to be circled or selected.
    
    CRITICAL GUIDELINES:
    - Be comprehensive. If it looks like a place for a student to interact (click, select, or type), detect it.
    - For multiple choice, target the marker (the letter/bubble) or the immediate vicinity intended for selection.
    - For text entry, target the entire line or box provided for the answer.
    - IGNORE structural text (questions, titles, instructions) unless it's the target itself.
    - Try to provide a label even if it's just a number or placeholder like "Blank".
    
    For each detection, provide:
    - label: String. The text label if any (e.g. "a", "A.", "1."). If no text, use a generic semantic label (e.g. "Checkbox", "Answer Line").
    - x, y: Number. Normalized coordinates (0 to 1) for the EXACT center of the marker or target area.
    - width, height: Number. Normalized width and height (0 to 1). 
      - Multiple choice bubbles: typically 0.02 - 0.05.
      - Text lines: typically width 0.1 - 0.4, height 0.02 - 0.06.
    - type: String. "choice" for bubbles/letters/boxes to be clicked, or "text-response" for lines/areas to be typed in.
    - isCorrect: Boolean. Mark true ONLY if it is already circled, checked, or otherwise visually indicated as the key/correct answer in the source image.
    
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
    }, "gemini-1.5-flash", imageData);

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
    }, "gemini-1.5-flash");

    return extractJSON(response.text) || [];
  } catch (e: any) {
    console.error("Gemini Error (generateQuizItems):", e);
    throw e;
  }
};
