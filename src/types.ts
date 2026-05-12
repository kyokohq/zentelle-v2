export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'student' | 'teacher' | 'admin';
  schoolId?: string | null;
  gradeLevel?: string;
  program?: string;
  // SIS Fields
  dob?: string;
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  enrollmentDate?: any;
  graduationYear?: string;
  gpa?: string;
  lockerNumber?: string;
}

export interface School {
  id: string;
  name: string;
  description: string;
  domain?: string;
  color: string;
  logoUrl?: string;
  uid: string;
  timestamp: any;
  academicYear?: string;
}

export interface Course {
  id: string;
  title: string;
  instructor: string;
  section: string;
  tag: string;
  color: string;
  image: string;
  grade: string;
  code: string; // Added course code for joining
  schoolId?: string | null;
}

export interface Enrollment {
  id: string;
  uid: string;
  courseId: string;
  grade: string;
}

export interface Activity {
  id: string;
  type: 'discussion' | 'grade_update';
  title: string;
  content: string;
  timestamp: string;
  courseId: string;
  uid: string;
  authorName: string;
}

export interface Reminder {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  dueDate: string;
  uid: string;
}

export interface Event {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  day: string;
  month: string;
  color: string;
  textColor: string;
  uid: string;
}

export interface Task {
  id: string;
  title: string;
  courseId?: string;
  dueDate: string;
  status: 'pending' | 'completed';
  uid: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  uid: string;
}

export interface Resource {
  id: string;
  title: string;
  category: string;
  type: 'pdf' | 'video' | 'link';
  url: string;
  courseId: string;
  uid: string;
}

export interface CourseMessage {
  id: string;
  courseId: string;
  text: string;
  uid: string;
  authorName: string;
  authorPhoto?: string;
  timestamp: string;
}

export interface HotspotData {
  type: 'correct' | 'incorrect' | 'info' | 'text-response';
  content: string;
  points?: number;
  id?: string;
}

export interface Material {
  id: string;
  courseId: string;
  parentId: string | null;
  type: 'folder' | 'assignment' | 'file' | 'link' | 'quiz' | 'worksheet';
  title: string;
  description?: string;
  color?: string;
  googleDriveFileId?: string;
  googleDriveTemplateId?: string;
  googleDriveTemplateType?: 'document' | 'presentation' | 'spreadsheet';
  url?: string;
  points?: number;
  dueDate?: any;
  uid: string;
  timestamp: any;
  published: boolean; 
  order?: number;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  type: 'multiple-choice' | 'checkbox' | 'matching' | 'image-hotspot' | 'short-answer' | 'true-false' | 'essay' | 'fill-in-the-blank' | 'dropdown' | 'file-upload';
  question: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer?: string;
  correctAnswers?: string[];
  matchingPairs?: Record<string, string>;
  hotspots?: {
    x: number;
    y: number;
    width: number;
    height: number;
    feedback?: string;
    isCorrect: boolean;
    label?: string;
  }[];
  dropdownOptions?: string[];
  blankCorrectAnswers?: string[];
  keywords?: string[];
  points?: number;
  order: number;
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  uid: string;
  staidentId?: string;
  isSimulated?: boolean;
  answers: Record<string, any>;
  score?: number;
  status: 'in-progress' | 'submitted';
  timestamp: any;
}

export interface Submission {
  id: string;
  materialId: string;
  uid: string;
  staidentId?: string; 
  isSimulated?: boolean;
  simulationExplanation?: string;
  googleDriveFileId?: string;
  fileUrl?: string;
  textSubmission?: string;
  status: 'draft' | 'submitted';
  grade?: number;
  feedback?: string;
  markupData?: string; // Added for canvas markup
  studentName?: string;
  submittedAt?: any;
  timestamp: any;
}

export interface Staident {
  id: string;
  courseId: string;
  schoolId?: string; // Added for SIS tracking
  name: string;
  personality: string;
  skillLevel: 'low' | 'average' | 'exceptional';
  behaviorPattern: 'diligent' | 'procrastinator' | 'struggling' | 'random';
  workHabit: string;
  avatarSeed: string;
  timestamp: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export enum Type {
  TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED",
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
  NULL = "NULL",
}

export interface StudentProfile extends UserProfile {
  dob?: string;
  address?: string;
  phone?: string;
  guardianIds?: string[];
  enrollmentDate?: any;
  graduationYear?: string;
  gpa?: string;
  rank?: number;
  athleticEligibility?: boolean;
  specialEd?: boolean;
  disciplineRecords?: DisciplineRecord[];
  healthNotes?: string;
}

export interface Guardian {
  id: string;
  name: string;
  relation: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  studentIds: string[];
}

export interface DisciplineRecord {
  id: string;
  date: any;
  incidentType: string;
  description: string;
  penalty: string;
  staffUid: string;
}

export interface AttendanceRecord {
  id: string;
  studentUid: string;
  courseId?: string; // Optional for daily vs period attendance
  date: any;
  status: 'present' | 'absent' | 'tardy' | 'excused';
  notes?: string;
  recordedBy: string;
}

export interface StaidentMessage {
  id: string;
  staidentId: string;
  courseId: string;
  text: string;
  uid: string;
  authorName: string;
  timestamp: any;
  isFromStaident: boolean;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
