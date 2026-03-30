import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Material, Submission, UserProfile, Enrollment, OperationType } from '../types';
import { motion } from 'motion/react';
import { 
  Search, 
  Download, 
  Filter, 
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Clock,
  User as UserIcon,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  FileText,
  Eye,
  X
} from 'lucide-react';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface GradebookProps {
  courseId: string;
  isAdmin: boolean;
}

export default function Gradebook({ courseId, isAdmin }: GradebookProps) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<Material[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [editingGrade, setEditingGrade] = useState<{ submissionId: string, grade: number, feedback: string, studentName: string, assignmentTitle: string } | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    if (!courseId) return;

    // Fetch enrollments to get students
    const qEnrollments = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
    const unsubEnrollments = onSnapshot(qEnrollments, async (snapshot) => {
      const studentIds = snapshot.docs.map(doc => doc.data().uid);
      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Fetch user profiles for these students
      const studentProfiles: UserProfile[] = [];
      for (const uid of studentIds) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (!userDoc.empty) {
          studentProfiles.push({ id: userDoc.docs[0].id, ...userDoc.docs[0].data() } as any);
        }
      }
      setStudents(studentProfiles);
    });

    // Fetch assignments
    const qAssignments = query(
      collection(db, 'materials'), 
      where('courseId', '==', courseId),
      where('type', '==', 'assignment')
    );
    const unsubAssignments = onSnapshot(qAssignments, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    });

    // Fetch all submissions for this course's assignments
    const qSubmissions = query(collection(db, 'submissions')); // We'll filter in memory or better yet, fetch per assignment if needed
    // Actually, we should probably have courseId on submissions too, but we can filter by materialId
    const unsubSubmissions = onSnapshot(qSubmissions, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });

    setLoading(false);

    return () => {
      unsubEnrollments();
      unsubAssignments();
      unsubSubmissions();
    };
  }, [courseId]);

  const getGrade = (studentId: string, assignmentId: string) => {
    const submission = submissions.find(s => s.uid === studentId && s.materialId === assignmentId);
    return submission ? submission.grade : null;
  };

  const getStatus = (studentId: string, assignmentId: string) => {
    const submission = submissions.find(s => s.uid === studentId && s.materialId === assignmentId);
    if (!submission) return 'missing';
    return submission.status;
  };

  const handleUpdateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrade) return;

    try {
      await updateDoc(doc(db, 'submissions', editingGrade.submissionId), {
        grade: editingGrade.grade,
        feedback: editingGrade.feedback
      });
      setEditingGrade(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `submissions/${editingGrade.submissionId}`);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = (s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (isAdmin) return matchesSearch;
    return s.uid === auth.currentUser?.uid && matchesSearch;
  });

  if (loading) {
    return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-[#004275] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 font-headline">Gradebook</h2>
          <p className="text-gray-500 text-sm">Manage student grades and feedback for all assignments.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-gray-600">
            <Download className="w-5 h-5" />
          </button>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-gray-600">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 font-black text-xs uppercase tracking-widest text-gray-400 min-w-[200px] sticky left-0 bg-gray-50 z-10">Student</th>
                {assignments.map(assignment => (
                  <th key={assignment.id} className="p-4 font-black text-xs uppercase tracking-widest text-gray-400 min-w-[150px] text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="truncate max-w-[120px]">{assignment.title}</span>
                      <span className="text-[10px] text-gray-300 font-medium">Max: {assignment.points || 100}</span>
                    </div>
                  </th>
                ))}
                <th className="p-4 font-black text-xs uppercase tracking-widest text-gray-400 min-w-[100px] text-center">Average</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => {
                let totalGrade = 0;
                let gradedCount = 0;
                
                return (
                  <tr key={student.uid} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td className="p-4 sticky left-0 bg-white group-hover:bg-gray-50 transition-colors z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#004275]/10 flex items-center justify-center text-[#004275] font-bold text-xs">
                          {student.photoURL ? (
                            <img src={student.photoURL} alt="" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                          ) : student.displayName?.[0] || 'S'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{student.displayName}</p>
                          <p className="text-[10px] text-gray-400 truncate">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    {assignments.map(assignment => {
                      const grade = getGrade(student.uid, assignment.id);
                      const status = getStatus(student.uid, assignment.id);
                      const submission = submissions.find(s => s.uid === student.uid && s.materialId === assignment.id);
                      
                      if (grade !== null) {
                        totalGrade += (grade / (assignment.points || 100)) * 100;
                        gradedCount++;
                      }

                      return (
                        <td key={assignment.id} className="p-4 text-center">
                          <div className="flex flex-col items-center gap-2">
                            {isAdmin ? (
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => {
                                    if (submission) {
                                      setEditingGrade({
                                        submissionId: submission.id,
                                        grade: submission.grade || 0,
                                        feedback: submission.feedback || '',
                                        studentName: student.displayName || 'Student',
                                        assignmentTitle: assignment.title
                                      });
                                    }
                                  }}
                                  className={`w-16 py-1.5 rounded-lg font-bold text-sm transition-all ${
                                    grade !== null 
                                      ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                                      : status === 'submitted'
                                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                  }`}
                                >
                                  {grade !== null ? grade : status === 'submitted' ? 'Grade' : '-'}
                                </button>
                                {status === 'submitted' && (
                                  <button 
                                    onClick={() => setViewingSubmission(submission || null)}
                                    className="p-1.5 text-gray-400 hover:text-[#004275] transition-colors"
                                    title="View Submission"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className={`text-sm font-bold ${grade !== null ? 'text-gray-900' : 'text-gray-300'}`}>
                                {grade !== null ? grade : '-'}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-4 text-center">
                      <div className="font-black text-[#004275]">
                        {gradedCount > 0 ? Math.round(totalGrade / gradedCount) + '%' : 'N/A'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Editing Modal */}
      {editingGrade && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
          >
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900">Assign Grade</h3>
              <p className="text-sm text-gray-500">{editingGrade.studentName} • {editingGrade.assignmentTitle}</p>
            </div>
            <form onSubmit={handleUpdateGrade} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Score</label>
                <input 
                  type="number"
                  value={editingGrade.grade}
                  onChange={(e) => setEditingGrade({ ...editingGrade, grade: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Feedback</label>
                <textarea 
                  value={editingGrade.feedback}
                  onChange={(e) => setEditingGrade({ ...editingGrade, feedback: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all resize-none h-32"
                  placeholder="Add comments for the student..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingGrade(null)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#004275] text-white rounded-xl font-bold hover:bg-[#005a9c] transition-all shadow-lg"
                >
                  Save Grade
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* View Submission Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Student Submission</h3>
                <p className="text-sm text-gray-500">{viewingSubmission.studentName} • {assignments.find(a => a.id === viewingSubmission.materialId)?.title}</p>
              </div>
              <button 
                onClick={() => setViewingSubmission(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <AlertCircle className="w-6 h-6 text-gray-400 rotate-45" />
              </button>
            </div>

            <div className="space-y-6">
              {viewingSubmission.googleDriveFileId ? (
                <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-blue-900">Google Drive Document</h4>
                    <p className="text-sm text-blue-700">The student submitted a Google Doc.</p>
                  </div>
                  <a 
                    href={`https://docs.google.com/document/d/${viewingSubmission.googleDriveFileId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" /> Open
                  </a>
                </div>
              ) : (
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
                  <h4 className="font-bold text-gray-900 mb-2">Text Submission</h4>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {viewingSubmission.textSubmission || 'No text content provided.'}
                  </p>
                </div>
              )}

              <div className="pt-6 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => {
                    const assignment = assignments.find(a => a.id === viewingSubmission.materialId);
                    setEditingGrade({
                      submissionId: viewingSubmission.id,
                      grade: viewingSubmission.grade || 0,
                      feedback: viewingSubmission.feedback || '',
                      studentName: viewingSubmission.studentName || 'Student',
                      assignmentTitle: assignment?.title || 'Assignment'
                    });
                    setViewingSubmission(null);
                  }}
                  className="bg-[#004275] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#005a9c] transition-all shadow-lg"
                >
                  Grade this Submission
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
