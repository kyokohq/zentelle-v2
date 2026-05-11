import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  doc, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from '../firebase';
import { Staident, Material, Submission, UserProfile, QuizQuestion, QuizSubmission } from '../types';

// Initialize Gemini AI
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

const PERSONALITIES = [
  "Curious and eager to learn, but sometimes overthinks simple questions.",
  "Highly analytical, prefers structured instructions, and gets frustrated with ambiguity.",
  "Creative but messy, often writes long but disorganized responses.",
  "Struggling but trying hard, uses simple language and often misses key technical terms.",
  "Bored and highly capable, gives correct but very brief answers.",
  "Anxious about deadlines, often submits early but with minor errors due to rushing.",
  "Social and collaborative, references 'class discussions' (even simulated ones) in work."
];

const NAMES = [
  "Alex Rivera", "Jordan Chen", "Sarah Miller", "Leo Kim", 
  "Maya Patel", "Sam Wilson", "Elena Rodriguez", "Chris Taylor",
  "Aisha Khan", "Noah Garcia", "Zoe Brown", "Liam O'Connor"
];

export const StaidentService = {
  async addStaidentsToCourse(courseId: string, count: number, schoolId?: string) {
    const staidents: Partial<Staident>[] = [];
    
    for (let i = 0; i < count; i++) {
      const name = NAMES[Math.floor(Math.random() * NAMES.length)] + " " + (i + 1);
      const skillLevels: ('low' | 'average' | 'exceptional')[] = ['low', 'average', 'exceptional'];
      const behaviorPatterns: ('diligent' | 'procrastinator' | 'struggling' | 'random')[] = ['diligent', 'procrastinator', 'struggling', 'random'];
      
      const staidentData: any = {
        courseId,
        schoolId: schoolId || '',
        name,
        personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
        skillLevel: skillLevels[Math.floor(Math.random() * skillLevels.length)],
        behaviorPattern: behaviorPatterns[Math.floor(Math.random() * behaviorPatterns.length)],
        workHabit: "Randomized work habits based on personality.",
        avatarSeed: Math.random().toString(36).substring(7),
        timestamp: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'staidents'), staidentData);
      staidents.push({ id: docRef.id, ...staidentData });
    }
    
    return staidents;
  },

  async removeStaidentsFromCourse(courseId: string, count: number) {
    console.log(`Attempting to remove ${count} staidents for course ${courseId}`);
    const q = query(
      collection(db, 'staidents'), 
      where('courseId', '==', courseId)
    );
    const snap = await getDocs(q);
    console.log(`Found ${snap.size} total staidents for this course.`);
    const toDelete = snap.docs.slice(0, count);
    
    console.log(`Deleting ${toDelete.length} staidents...`);
    const deletions = toDelete.map(d => deleteDoc(doc(db, 'staidents', d.id)));
    await Promise.all(deletions);
    console.log("Deletions complete.");
    return toDelete.length;
  },

  async removeSingleStaident(id: string) {
    try {
      await deleteDoc(doc(db, 'staidents', id));
      return true;
    } catch (error) {
      console.error("Error deleting single staident:", error);
      throw error;
    }
  },

  async getStaidentsForCourse(courseId: string) {
    const q = query(collection(db, 'staidents'), where('courseId', '==', courseId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staident));
  },

  async generateSubmissionContent(assignment: Material, staident: Staident) {
    const prompt = `
      Create a realistic student assignment submission.
      Assignment Title: ${assignment.title}
      Assignment Description: ${assignment.description || 'No description provided.'}
      
      Student Profile:
      - Name: ${staident.name}
      - Personality: ${staident.personality}
      - Skill Level: ${staident.skillLevel}
      - Behavior Pattern: ${staident.behaviorPattern}
      
      Requirements:
      1. Write the submission in first person as the student.
      2. Match the skill level (exceptional = polished, average = okay, low = many mistakes/confused).
      3. Match the personality (e.g., if creative, make it long; if bored, make it brief).
      4. Sometimes include realistic mistakes or misconceptions.
      5. Return ONLY the text of the submission.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      return response.text || "I tried my best but was a bit confused by the prompt.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Student failed to generate content due to an internal error.";
    }
  },

  async generateMarkupContent(assignment: Material, staident: Staident) {
    const prompt = `
      Create a realistic set of "markup" entries for a worksheet assignment.
      The output MUST be a JSON array of objects, where each object represents a Fabric.js element (TextBox).
      
      Assignment Title: ${assignment.title}
      Student Profile: ${staident.name} (Level: ${staident.skillLevel})
      
      Requirements:
      1. Generate 3-5 short text entries that a student would write on a digital worksheet.
      2. The text should be appropriate for the student's skill level.
      3. Use random positions: left between 50-600, top between 50-800.
      
      Output ONLY a JSON array of objects with this schema:
      {
        "type": "i-text",
        "text": string,
        "left": number,
        "top": number,
        "fontSize": number (16-24),
        "fontFamily": "Inter",
        "fill": "#004275"
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                text: { type: Type.STRING },
                left: { type: Type.NUMBER },
                top: { type: Type.NUMBER },
                fontSize: { type: Type.NUMBER },
                fontFamily: { type: Type.STRING },
                fill: { type: Type.STRING }
              },
              required: ["type", "text", "left", "top"]
            }
          }
        }
      });
      
      const objects = JSON.parse(response.text || "[]");
      // Add version and background container expected by Fabric 6 JSON
      return JSON.stringify({
        version: "6.0.0",
        objects: objects.map((obj: any) => ({
          ...obj,
          version: "6.0.0",
          originX: "left",
          originY: "top"
        }))
      });
    } catch (error) {
      console.error("Gemini Markup Error:", error);
      return JSON.stringify({ version: "6.0.0", objects: [] });
    }
  },

  async generateQuizSubmission(quiz: Material, questions: QuizQuestion[], staident: Staident) {
    const prompt = `
      Simulate a student taking a quiz.
      Quiz Title: ${quiz.title}
      Questions: ${JSON.stringify(questions.map(q => ({ id: q.id, type: q.type, question: q.question, options: q.options })))}
      
      Student Profile:
      - Name: ${staident.name}
      - Skill Level: ${staident.skillLevel}
      
      Requirements:
      1. Provide a realistic set of answers for this student.
      2. Match the skill level (exceptional = mostly correct, average = some mistakes, low = many mistakes or random guesses).
      3. For multiple-choice/checkbox: return the selected option(s) as strings.
      4. For short-answer: return a brief text response.
      5. For matching/hotspot types: return a plausible set of labels or pairs.
      6. Return ONLY a JSON object where keys are question IDs and values are the answers.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            additionalProperties: { type: Type.STRING } 
          }
        }
      });
      
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Gemini Quiz Error:", error);
      return {};
    }
  },

  async simulateSubmission(assignment: Material, staident: Staident, delayMs: number) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        // 1-3 Staidents might fail or be late
        const roll = Math.random();
        let status: 'submitted' | 'draft' = 'submitted';
        let explanation = "";
        let content = "";
        let markupData = "";
        let quizAnswers: Record<string, any> = {};

        if (roll < 0.1) { // 10% chance to forget/missing
          status = 'draft';
          explanation = "Student forgot to submit or was too overwhelmed.";
        } else if (roll < 0.2) { // 10% chance to be confused
          content = "I didn't really understand how to start this project... I'm sorry.";
          explanation = "Student appeared confused by the instructions.";
        } else if (assignment.type === 'quiz') {
          // Load questions first
          const qSnap = await getDocs(query(collection(db, 'quiz_questions'), where('quizId', '==', assignment.id)));
          const questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as QuizQuestion));
          quizAnswers = await this.generateQuizSubmission(assignment, questions, staident);
          
          // Calculate score internally for simulation
          let correct = 0;
          questions.forEach(q => {
            if (quizAnswers[q.id] === q.correctAnswer) correct++;
          });
          const score = Math.round((correct / questions.length) * 100);

          const qSub: Partial<QuizSubmission> = {
            quizId: assignment.id,
            uid: `staident_${staident.id}`,
            staidentId: staident.id,
            answers: quizAnswers,
            score,
            status: 'submitted',
            isSimulated: true,
            timestamp: serverTimestamp()
          };
          await addDoc(collection(db, 'quiz_submissions'), qSub);
          
          // Also record in main submissions for the list
          const subData = {
            materialId: assignment.id,
            uid: `staident_${staident.id}`,
            staidentId: staident.id,
            studentName: staident.name,
            grade: score,
            isSimulated: true,
            status: 'submitted',
            timestamp: serverTimestamp(),
            submittedAt: serverTimestamp()
          };
          await addDoc(collection(db, 'submissions'), subData);
          resolve(subData);
          return;
        } else {
          content = await this.generateSubmissionContent(assignment, staident);
          // If it's a worksheet or has a URL, generate markup
          if (assignment.type === 'worksheet' || assignment.url) {
            markupData = await this.generateMarkupContent(assignment, staident);
          }
        }

        const submissionData = {
          materialId: assignment.id,
          uid: `staident_${staident.id}`, // Placeholder UID prefix for staidents
          staidentId: staident.id,
          studentName: staident.name,
          isSimulated: true,
          simulationExplanation: explanation,
          textSubmission: content,
          markupData,
          status,
          timestamp: serverTimestamp(),
          submittedAt: serverTimestamp()
        };

        try {
          await addDoc(collection(db, 'submissions'), submissionData);
          resolve(submissionData);
        } catch (error) {
          console.error("Submission error:", error);
          resolve(null);
        }
      }, delayMs);
    });
  },

  async runSimulation(assignment: Material, staidents: Staident[], baseDelaySeconds: number) {
    const tasks = staidents.map(s => {
      // Add randomness to the delay (up to +/- 20%)
      const variance = (Math.random() * 0.4) + 0.8; // 0.8 to 1.2
      const actualDelay = baseDelaySeconds * 1000 * variance;
      return this.simulateSubmission(assignment, s, actualDelay);
    });
    
    return Promise.all(tasks);
  },

  async generateMessageResponse(staident: Staident, history: { text: string, isFromStaident: boolean }[], newMessage: string) {
    const historyText = history.map(h => 
      `${h.isFromStaident ? staident.name : 'Teacher'}: ${h.text}`
    ).join('\n');

    const prompt = `
      You are simulating a student in a classroom. 
      Student Name: ${staident.name}
      Personality: ${staident.personality}
      Skill Level: ${staident.skillLevel}
      Behavior Pattern: ${staident.behaviorPattern}
      
      Conversation History:
      ${historyText}
      
      Teacher's new message: ${newMessage}
      
      Requirements:
      1. Respond as ${staident.name}.
      2. Stay in character based on the personality and behavior pattern.
      3. If the teacher asks an academic question, your response should reflect your skill level (e.g., if skill level is 'low', you might be confused or make mistakes).
      4. Keep the response relatively brief (1-3 sentences).
      5. Return ONLY the text of the student's response.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      return response.text || "I'm not sure how to respond to that.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "The student is unable to respond right now.";
    }
  }
};
