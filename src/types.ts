export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'student' | 'admin';
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

export interface Material {
  id: string;
  courseId: string;
  parentId: string | null;
  type: 'folder' | 'assignment' | 'file' | 'link';
  title: string;
  description?: string;
  color?: string;
  googleDriveFileId?: string;
  googleDriveTemplateId?: string;
  url?: string;
  points?: number;
  dueDate?: any;
  uid: string;
  timestamp: any;
  published: boolean; // Added for publishing/unpublishing
}

export interface Submission {
  id: string;
  materialId: string;
  uid: string;
  googleDriveFileId?: string;
  fileUrl?: string;
  textSubmission?: string;
  status: 'draft' | 'submitted';
  grade?: number;
  feedback?: string;
  studentName?: string;
  submittedAt?: any;
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
