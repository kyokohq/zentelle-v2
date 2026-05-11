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
import { db, auth } from '../firebase';
import { Staident, Material, Submission, UserProfile } from '../types';

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
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate content');
      }
      
      const data = await response.json();
      return data.text || "I tried my best but was a bit confused by the prompt.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Student failed to generate content due to an internal error.";
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

        if (roll < 0.1) { // 10% chance to forget/missing
          status = 'draft';
          explanation = "Student forgot to submit or was too overwhelmed.";
        } else if (roll < 0.2) { // 10% chance to be confused
          content = "I didn't really understand how to start this project... I'm sorry.";
          explanation = "Student appeared confused by the instructions.";
        } else {
          content = await this.generateSubmissionContent(assignment, staident);
        }

        const submissionData = {
          materialId: assignment.id,
          uid: `staident_${staident.id}`, // Placeholder UID prefix for staidents
          staidentId: staident.id,
          studentName: staident.name,
          isSimulated: true,
          simulationExplanation: explanation,
          textSubmission: content,
          status,
          timestamp: serverTimestamp(),
          submittedAt: serverTimestamp()
        };

        try {
          await addDoc(collection(db, 'submissions'), submissionData);
          resolve(submissionData);
        } catch (error) {
          console.error("Submission error:", error);
          // Standardized error handling for debugging
          const errInfo = {
            error: error instanceof Error ? error.message : String(error),
            authInfo: {
              userId: auth.currentUser?.uid,
              email: auth.currentUser?.email
            },
            operationType: 'create',
            path: 'submissions'
          };
          console.error('Firestore Error Detail: ', JSON.stringify(errInfo));
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
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) throw new Error('Failed to generate response');
      
      const data = await response.json();
      return data.text || "I'm not sure how to respond to that.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "The student is unable to respond right now.";
    }
  }
};
