import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Enrollment } from '../types';
import { 
  Plus, 
  Search, 
  X, 
  UserPlus, 
  UserMinus,
  Check,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function EnrollmentManager({ courseId, schoolId }: { courseId: string, schoolId: string }) {
  const [enrolledStudents, setEnrolledStudents] = useState<UserProfile[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!courseId || typeof courseId !== 'string') {
      setLoading(false);
      return;
    }

    // Listen for enrollments
    const qEnrollments = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
    const unsubEnrollments = onSnapshot(qEnrollments, async (snapshot) => {
      const studentIds = snapshot.docs
        .map(doc => doc.data().uid || doc.data().studentId || doc.id.split('_')[0])
        .filter(id => id && typeof id === 'string');
      
      if (studentIds.length > 0) {
        setLoading(true);
        // Fetch students in batches
        const batches = [];
        for (let i = 0; i < studentIds.length; i += 10) {
          batches.push(studentIds.slice(i, i + 10));
        }

        const studentData: UserProfile[] = [];
        for (const batch of batches) {
          // Additional safety check for batch content
          const validIds = batch.filter(id => id && typeof id === 'string');
          if (validIds.length === 0) continue;

          const q = query(collection(db, 'users'), where('uid', 'in', validIds));
          try {
            const snap = await getDocs(q);
            studentData.push(...snap.docs.map(d => d.data() as UserProfile));
          } catch (e) {
            console.error("Batch fetch error:", e);
          }
        }
        setEnrolledStudents(studentData);
      } else {
        setEnrolledStudents([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Enrollment snapshot error:", error);
      setLoading(false);
    });

    // Fetch all students in school for adding
    if (!schoolId || typeof schoolId !== 'string') {
      setAllStudents([]);
      return;
    }

    const qAllStudents = query(
      collection(db, 'users'), 
      where('schoolId', '==', schoolId),
      where('role', '==', 'student')
    );
    const unsubAllStudents = onSnapshot(qAllStudents, (snapshot) => {
      setAllStudents(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      console.error("All students snapshot error:", error);
    });

    return () => {
      unsubEnrollments();
      unsubAllStudents();
    };
  }, [courseId, schoolId]);

  const enrollStudent = async (student: UserProfile) => {
    try {
      await setDoc(doc(db, 'enrollments', `${student.uid}_${courseId}`), {
        uid: student.uid,
        courseId: courseId,
        studentName: student.displayName,
        grade: 'N/A',
        enrolledAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error enrolling student:", error);
    }
  };

  const removeEnrollment = async (studentId: string) => {
    if (confirm("Remove this student from the course?")) {
      try {
        await deleteDoc(doc(db, 'enrollments', `${studentId}_${courseId}`));
      } catch (error) {
        console.error("Error removing enrollment:", error);
      }
    }
  };

  const availableStudents = allStudents.filter(s => 
    !enrolledStudents.find(es => es.uid === s.uid) &&
    (s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-black text-[#1a1c1c] font-headline">Course Enrollment</h3>
          <p className="text-sm text-gray-500">Manage students enrolled in this course.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#004275] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#005a9c] transition-all shadow-lg active:scale-95 text-sm"
        >
          <UserPlus className="w-5 h-5" /> Enroll Student
        </button>
      </div>

      <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/50 text-left">
            <tr>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Student</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Level</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrolledStudents.map(student => (
              <tr key={student.uid} className="hover:bg-white transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#004275] text-white flex items-center justify-center font-bold text-xs">
                      {student.displayName?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{student.displayName}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{student.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {student.gradeLevel || 'N/A'} {student.program ? `(${student.program})` : ''}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => removeEnrollment(student.uid)}
                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {enrolledStudents.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-400 font-medium italic">
                  No students enrolled in this course yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-[#004275] font-headline">Enroll Students</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text"
                  placeholder="Search students in school..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#004275]/10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {availableStudents.map(student => (
                  <div key={student.uid} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-[#004275]/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#004275] font-bold border border-gray-200">
                        {student.displayName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{student.displayName}</p>
                        <p className="text-xs text-gray-500">{student.gradeLevel || 'No Grade'} {student.program ? `• ${student.program}` : ''}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => enrollStudent(student)}
                      className="p-2 bg-[#004275] text-white rounded-xl hover:bg-[#005a9c] transition-all shadow-md active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {availableStudents.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    {searchTerm ? "No students match your search." : "All school students are already enrolled!"}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowAddModal(false)}
                className="w-full mt-6 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg active:scale-95"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
