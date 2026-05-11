import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { User, Search, GraduationCap } from 'lucide-react';

export function Classmates({ courseId }: { courseId: string }) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!courseId) return;

    const qEnrollments = query(collection(db, 'enrollments'), where('courseId', '==', courseId));
    const unsubEnrollments = onSnapshot(qEnrollments, async (snapshot) => {
      const studentIds = snapshot.docs
        .map(doc => doc.data().studentId || doc.id.split('_')[0])
        .filter(id => id && typeof id === 'string');
      
      if (studentIds.length > 0) {
        // Fetch students in batches of 10 to avoid query limits
        const batches = [];
        for (let i = 0; i < studentIds.length; i += 10) {
          batches.push(studentIds.slice(i, i + 10));
        }

        const studentData: UserProfile[] = [];
        for (const batch of batches) {
          const validIds = batch.filter(id => id && typeof id === 'string');
          if (validIds.length === 0) continue;
          
          const q = query(collection(db, 'users'), where('uid', 'in', validIds));
          try {
            const snap = await getDocs(q);
            studentData.push(...snap.docs.map(d => d.data() as UserProfile));
          } catch (e) {
            console.error("Error fetching student batch:", e);
          }
        }
        setStudents(studentData);
      } else {
        setStudents([]);
      }
      setLoading(false);
    });

    return () => unsubEnrollments();
  }, [courseId]);

  const filteredStudents = students.filter(s => 
    s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-[#004275] border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-black text-[#1a1c1c] font-headline">Classmates</h3>
          <p className="text-sm text-gray-500">Meet the people you're learning with.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Search classmates..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map(student => (
          <div key={student.uid} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-[#004275]/30 hover:shadow-md transition-all group">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                {student.photoURL ? (
                  <img src={student.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#004275] text-white font-bold text-sm">
                    {student.displayName?.charAt(0) || student.email?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate group-hover:text-[#004275] transition-colors">{student.displayName}</p>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <GraduationCap className="w-3 h-3" />
                {student.gradeLevel || 'Student'}
              </div>
            </div>
          </div>
        ))}

        {filteredStudents.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
            <User className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No classmates found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
