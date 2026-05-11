import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy,
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { School, UserProfile, Staident } from '../types';
import { 
  Shield, 
  School as SchoolIcon, 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Globe, 
  MoreVertical,
  Check,
  X,
  GraduationCap,
  AlertCircle,
  Clock,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Admin({ currentUserId, currentSchoolId, userEmail }: { currentUserId: string, currentSchoolId: string | null, userEmail: string | null }) {
  const [activeTab, setActiveTab] = useState<'users' | 'schools' | 'settings' | 'sis' | 'attendance' | 'discipline'>('users');
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [staidents, setStaidents] = useState<Staident[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const isSuperAdmin = currentUserId === 'shanesdih' || userEmail === 'piercesnyder39@gmail.com';

  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | any | null>(null);
  const [showDisciplineModal, setShowDisciplineModal] = useState(false);
  const [disciplineSearchTerm, setDisciplineSearchTerm] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const currentSchool = schools.find(s => s.id === currentSchoolId);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size exceeds 2MB limit.");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        
        // If in settings tab, update the current school logo immediately
        if (activeTab === 'settings' && currentSchoolId) {
          try {
            const schoolRef = doc(db, 'schools', currentSchoolId);
            const snap = await getDocs(query(collection(db, 'schools'), where('__name__', '==', currentSchoolId)));
            if (!snap.empty) {
              const currentData = snap.docs[0].data();
              await setDoc(schoolRef, { ...currentData, logoUrl: base64 });
              alert("School logo updated successfully.");
            }
          } catch (error) {
            console.error("Error updating logo:", error);
            alert("Failed to update logo: " + (error instanceof Error ? error.message : "Undefined error"));
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateAcademicYear = async (academicYear: string) => {
    if (!currentSchoolId || !currentSchool) return;
    try {
      await setDoc(doc(db, 'schools', currentSchoolId), { 
        ...currentSchool, 
        academicYear 
      });
      alert("Academic year updated successfully.");
    } catch (error) {
      console.error("Error updating academic year:", error);
      alert("Failed to update academic year.");
    }
  };

  useEffect(() => {
    setLoading(true);
    
    let schoolsQuery = query(collection(db, 'schools'), orderBy('timestamp', 'desc'));
    if (!isSuperAdmin && currentSchoolId) {
      schoolsQuery = query(collection(db, 'schools'), where('__name__', '==', currentSchoolId));
    }

    const unsubSchools = onSnapshot(schoolsQuery, (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    });

    let usersQuery = query(collection(db, 'users'));
    if (!isSuperAdmin && currentSchoolId) {
      usersQuery = query(collection(db, 'users'), where('schoolId', '==', currentSchoolId));
      setActiveTab('users'); // Default to users if not super admin
    }

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    });

    // Fetch Staidents for SIS
    let staidentsQuery = query(collection(db, 'staidents'));
    if (!isSuperAdmin && currentSchoolId) {
      staidentsQuery = query(collection(db, 'staidents'), where('schoolId', '==', currentSchoolId));
    }

    const unsubStaidents = onSnapshot(staidentsQuery, (snapshot) => {
      setStaidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staident)));
    });

    // Attendance/Discipline filters
    let attendanceQuery = query(collection(db, 'attendance'));
    let disciplineQuery = query(collection(db, 'discipline'), orderBy('timestamp', 'desc'));
    
    if (!isSuperAdmin && currentSchoolId) {
      attendanceQuery = query(collection(db, 'attendance'), where('schoolId', '==', currentSchoolId));
      disciplineQuery = query(collection(db, 'discipline'), where('schoolId', '==', currentSchoolId), orderBy('timestamp', 'desc'));
    }

    const unsubAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubDiscipline = onSnapshot(disciplineQuery, (snapshot) => {
      setReferrals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);

    return () => {
      unsubSchools();
      unsubUsers();
      unsubStaidents();
      unsubAttendance();
      unsubDiscipline();
    };
  }, [isSuperAdmin, currentSchoolId]);

  const handleSaveSchool = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert("Only super-admins can create or modify school records directly.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const schoolData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      domain: formData.get('domain') as string,
      color: formData.get('color') as string || '#004275',
      logoUrl: formData.get('logoUrl') as string,
      timestamp: serverTimestamp(),
      uid: currentUserId
    };

    try {
      if (editingSchool) {
        await setDoc(doc(db, 'schools', editingSchool.id), { ...editingSchool, ...schoolData });
      } else {
        await addDoc(collection(db, 'schools'), schoolData);
      }
      setShowSchoolModal(false);
      setEditingSchool(null);
    } catch (error) {
      console.error("Error saving school:", error);
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!isSuperAdmin) {
      alert("Only super-admins can delete schools.");
      return;
    }
    if (confirm("Are you sure you want to delete this school?")) {
      try {
        await deleteDoc(doc(db, 'schools', id));
      } catch (error) {
        console.error("Error deleting school:", error);
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const role = formData.get('role') as 'student' | 'teacher' | 'admin';
    
    // In a real app, this would use Admin SDK to create user auth
    // For this prototype, we simulate creating a user entry
    const mockUid = "user_" + Math.random().toString(36).substring(7);
    const userData: UserProfile = {
      uid: mockUid,
      email,
      displayName: formData.get('displayName') as string,
      photoURL: null,
      role,
      schoolId: currentSchoolId,
      gradeLevel: formData.get('gradeLevel') as string || '',
      program: formData.get('program') as string || '',
      gpa: formData.get('gpa') as string || 'N/A',
      graduationYear: formData.get('graduationYear') as string || '2026',
      phone: formData.get('phone') as string || '',
      guardianName: formData.get('guardianName') as string || '',
      guardianPhone: formData.get('guardianPhone') as string || '',
      lockerNumber: formData.get('lockerNumber') as string || '',
      enrollmentDate: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', mockUid), userData);
      setShowAddUserModal(false);
    } catch (error) {
      console.error("Error creating user:", error);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const formData = new FormData(e.currentTarget);
    const updatedUser = {
      ...editingUser,
      role: formData.get('role') as 'student' | 'teacher' | 'admin',
      schoolId: formData.get('schoolId') as string || currentSchoolId,
      gradeLevel: formData.get('gradeLevel') as string || '',
      program: formData.get('program') as string || '',
      gpa: formData.get('gpa') as string || editingUser.gpa,
      graduationYear: formData.get('graduationYear') as string || editingUser.graduationYear,
      phone: formData.get('phone') as string || editingUser.phone,
      guardianName: formData.get('guardianName') as string || editingUser.guardianName,
      guardianPhone: formData.get('guardianPhone') as string || editingUser.guardianPhone,
      lockerNumber: formData.get('lockerNumber') as string || editingUser.lockerNumber
    };

    try {
      await setDoc(doc(db, 'users', editingUser.uid), updatedUser);
      setShowUserModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleDeleteUser = async (uid: string, isStaident?: boolean) => {
    if (!confirm(`Are you sure you want to ${isStaident ? 'remove this simulation student' : 'delete this user'}?`)) return;
    
    try {
      if (isStaident) {
        const staidentId = uid.replace('staident_', '');
        await deleteDoc(doc(db, 'staidents', staidentId));
      } else {
        await deleteDoc(doc(db, 'users', uid));
      }
      alert("Student/User removed successfully.");
      if (showStudentModal) setShowStudentModal(false);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete. Check console for permissions.");
    }
  };

  const handleTakeAttendance = async (uid: string, status: string) => {
    if (!currentSchoolId) return;
    const today = new Date().toISOString().split('T')[0];
    const attendanceId = `${uid}_${today}`;
    
    try {
      await setDoc(doc(db, 'attendance', attendanceId), {
        uid,
        date: today,
        status,
        schoolId: currentSchoolId,
        timestamp: serverTimestamp(),
        recordedBy: currentUserId
      });
    } catch (error) {
      console.error("Error taking attendance:", error);
    }
  };

  const handleAddReferral = async (student: any, type: string, description: string) => {
    if (!currentSchoolId) return;
    try {
      await addDoc(collection(db, 'discipline'), {
        uid: student.uid || student.id,
        studentName: student.displayName || student.name,
        type,
        description,
        schoolId: currentSchoolId,
        teacherId: currentUserId,
        timestamp: serverTimestamp()
      });
      alert('Discipline referral logged successfully.');
    } catch (error) {
      console.error("Error logging discipline:", error);
    }
  };

  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sisUsers = [
    ...users.filter(u => u.role === 'student'),
    ...staidents.map(s => ({
      uid: `staident_${s.id}`,
      displayName: `[AI] ${s.name}`,
      email: `${s.behaviorPattern}@simulation.edu`,
      role: 'student',
      schoolId: currentSchoolId,
      gradeLevel: s.skillLevel === 'exceptional' ? 'Advanced' : s.skillLevel === 'average' ? 'Standard' : 'Struggling',
      program: 'Simulation',
      isStaident: true
    } as any))
  ].filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-[#004275] font-headline flex items-center gap-3">
            <Shield className="w-8 h-8" />
            Admin Panel
          </h1>
          <p className="text-gray-500 mt-1">Manage schools, users, and global settings.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto max-w-full">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Users className="w-4 h-4" /> Users
          </button>
          <button 
            onClick={() => setActiveTab('sis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'sis' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <GraduationCap className="w-4 h-4" /> SIS
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'attendance' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Check className="w-4 h-4" /> Attendance
          </button>
          <button 
            onClick={() => setActiveTab('discipline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'discipline' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <AlertCircle className="w-4 h-4" /> Discipline
          </button>
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveTab('schools')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'schools' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <SchoolIcon className="w-4 h-4" /> Schools
            </button>
          )}
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Edit2 className="w-4 h-4" /> Branding
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text"
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#004275]/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {activeTab === 'users' && (
            <button 
              onClick={() => setShowAddUserModal(true)}
              className="bg-[#004275] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#005a9c] transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-5 h-5" /> Add User
            </button>
          )}
          {activeTab === 'schools' && isSuperAdmin && (
            <button 
              onClick={() => { setEditingSchool(null); setShowSchoolModal(true); }}
              className="bg-[#004275] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#005a9c] transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-5 h-5" /> Add School
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'schools' ? (
            <table className="w-full">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">School</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Domain</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Created</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSchools.map(school => (
                  <tr key={school.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: school.color }}>
                          {school.logoUrl ? (
                            <img src={school.logoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            school.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{school.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{school.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Globe className="w-4 h-4" />
                        <span className="text-sm">{school.domain || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {school.timestamp?.toDate ? new Date(school.timestamp.toDate()).toLocaleDateString() : 'Recently'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingSchool(school); setShowSchoolModal(true); }}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteSchool(school.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'sis' ? (
            <table className="w-full">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Student</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Status</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">GPA / Rank</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Graduation</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sisUsers.map(user => (
                  <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-white font-bold ${user.isStaident ? 'bg-gradient-to-br from-blue-500 to-[#004275]' : 'bg-gray-200 text-[#004275]'}`}>
                          {user.displayName?.charAt(0) || user.email?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{user.displayName || 'Unnamed'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.isStaident ? 'bg-blue-50 text-blue-600' : 'bg-green-100 text-green-700'}`}>
                        {user.isStaident ? 'Simulated' : 'Enrolled'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900">{user.isStaident ? 'AI Score: 88' : (user.gpa || '3.8') + ' / ' + (user.gradeLevel || '12th')}</div>
                      <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest font-mono">{user.isStaident ? 'Neural Net' : 'Academic Standing'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{user.isStaident ? 'N/A' : 'Class of ' + (user.graduationYear || '2026')}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedStudent(user); setShowStudentModal(true); }}
                          className="p-2 hover:bg-gray-100 text-[#004275] rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.uid, user.isStaident)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'attendance' ? (
            <div className="space-y-6">
              <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Today:</span>
                    <span className="ml-2 font-bold text-[#004275]">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Rate:</span>
                    <span className="ml-2 font-bold text-green-600">98.2%</span>
                  </div>
                </div>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Student</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Today's Status</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Recent History</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sisUsers.map(user => {
                    const today = new Date().toISOString().split('T')[0];
                    const todayStatus = attendance.find(a => a.uid === user.uid && a.date === today)?.status;
                    const studentAttendance = attendance.filter(a => a.uid === user.uid).slice(-5);
                    
                    return (
                      <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${user.isStaident ? 'bg-blue-500' : 'bg-gray-200 text-[#004275]'}`}>
                            {user.displayName?.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-gray-900">{user.displayName}</span>
                            {user.isStaident && <span className="ml-2 text-[8px] bg-blue-50 text-blue-600 px-1 rounded font-black uppercase">AI</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {todayStatus ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${todayStatus === 'PRESENT' ? 'bg-green-500' : todayStatus === 'ABSENT' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{todayStatus}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-300 uppercase italic">Not Marked</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => {
                              const hist = studentAttendance[i];
                              return (
                                <div key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-black ${
                                  hist?.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 
                                  hist?.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                                  hist?.status === 'TARDY' ? 'bg-amber-100 text-amber-700' : 
                                  'bg-gray-50 text-gray-300'
                                }`}>
                                  {hist?.status?.charAt(0) || '-'}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            {['PRESENT', 'ABSENT', 'TARDY'].map(s => (
                              <button 
                                key={s}
                                onClick={() => handleTakeAttendance(user.uid, s)}
                                className={`px-2 py-1 text-[8px] font-black rounded-lg transition-colors border ${
                                  todayStatus === s 
                                    ? s === 'PRESENT' ? 'bg-green-500 text-white border-green-500' : s === 'ABSENT' ? 'bg-red-500 text-white border-red-500' : 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'discipline' ? (
            <div className="space-y-6">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/30">
                <div>
                  <h3 className="font-black text-[#004275] uppercase tracking-widest text-[10px] mb-1">Incident Reports</h3>
                  <p className="text-sm text-gray-500">Track and manage student behavioral referrals.</p>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
                    <Filter className="w-3 h-3" /> Filter Log
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#004275] text-white rounded-xl text-xs font-bold hover:bg-[#005a9c] transition-all shadow-md">
                    <Plus className="w-3 h-3" /> New Referral
                  </button>
                </div>
              </div>
              
              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  {referrals.map(referral => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={referral.id} 
                      className="p-6 bg-white border border-gray-100 rounded-[32px] shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                            referral.type === 'MAJOR' ? 'bg-red-100 text-red-600' : 
                            referral.type === 'MINOR' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {referral.studentName?.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 group-hover:text-[#004275] transition-colors">{referral.studentName}</h4>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {referral.timestamp?.toDate ? new Date(referral.timestamp.toDate()).toLocaleString() : 'Just now'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          referral.type === 'MAJOR' ? 'bg-red-50 text-red-600' : 
                          referral.type === 'MINOR' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {referral.type} REFERRAL
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50">
                        {referral.description}
                      </p>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reported by: Staff ID {referral.teacherId?.slice(-4)}</span>
                        <button className="text-[10px] font-black text-[#004275] uppercase tracking-widest hover:underline">Full Report</button>
                      </div>
                    </motion.div>
                  ))}
                  {referrals.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-100">
                      <Shield className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No discipline referrals found.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="p-8 bg-gradient-to-br from-[#004275] to-[#005a9c] rounded-[40px] text-white shadow-xl">
                    <h4 className="font-black uppercase tracking-widest text-[10px] mb-4 opacity-80">Behavior Analytics</h4>
                    <div className="space-y-6">
                      <div>
                        <p className="text-3xl font-black">{referrals.length}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Referrals YTD</p>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white/40 w-3/4"></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                        <div>
                          <p className="text-lg font-black">{referrals.filter(r => r.type === 'MAJOR').length}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 text-red-200">Major Incidents</p>
                        </div>
                        <div>
                          <p className="text-lg font-black">{referrals.filter(r => r.type === 'MINOR').length}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 text-amber-200">Minor Incidents</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'settings' ? (
            <div className="p-12">
              <div className="max-w-3xl mx-auto space-y-12">
                <section>
                  <h3 className="text-xl font-black text-[#004275] mb-6 flex items-center gap-3">
                    <Globe className="w-6 h-6" />
                    Global Configuration
                  </h3>
                  <div className="bg-[#004275]/5 p-8 rounded-[40px] border border-[#004275]/10 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="block text-xs font-black uppercase tracking-widest text-[#004275] mb-2">School-wide Academic Year</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="e.g. 2025 - 2026"
                          className="flex-1 bg-white border border-[#004275]/20 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-[#004275]/10"
                          defaultValue={currentSchool?.academicYear}
                          id="academicYearInput"
                        />
                        <button 
                          onClick={() => {
                            const val = (document.getElementById('academicYearInput') as HTMLInputElement).value;
                            handleUpdateAcademicYear(val);
                          }}
                          className="bg-[#004275] text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#005a9c] transition-all"
                        >
                          Update
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">This will be visible on all student transcripts and dashboard headers.</p>
                    </div>

                    <div className="p-6 bg-white rounded-3xl border border-[#004275]/10 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current Setting</span>
                        <span className="px-2 py-1 bg-[#004275] text-white text-[8px] font-black rounded-md uppercase">Live</span>
                      </div>
                      <p className="text-2xl font-black text-[#004275]">{currentSchool?.academicYear || 'Not Set'}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                    <Shield className="w-6 h-6 text-gray-400" />
                    School Branding
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-8 bg-gray-50 rounded-[40px] border border-gray-100 flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Primary Accent</label>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl shadow-lg border-2 border-white" style={{ backgroundColor: currentSchool?.color }}></div>
                          <span className="font-mono font-bold text-gray-500 uppercase">{currentSchool?.color}</span>
                        </div>
                      </div>
                      <button className="text-[10px] font-black text-[#004275] uppercase tracking-widest hover:underline">Change</button>
                    </div>

                    <div className="p-8 bg-gray-50 rounded-[40px] border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-300 overflow-hidden">
                          {currentSchool?.logoUrl || logoPreview ? (
                            <img src={currentSchool?.logoUrl || logoPreview || ''} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <Plus className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-gray-400">School Logo</label>
                          <p className="text-[10px] font-bold text-gray-400">SVG, PNG or JPG max 2MB</p>
                        </div>
                      </div>
                      <label className="text-[10px] font-black text-[#004275] uppercase tracking-widest hover:underline cursor-pointer">
                        Upload
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">User</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">Role</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">School / Level</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map(user => (
                  <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#004275] text-white font-bold">
                              {user.displayName?.charAt(0) || user.email?.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{user.displayName || 'Unnamed'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                        user.role === 'teacher' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-gray-600">
                          <GraduationCap className="w-4 h-4" />
                          <span className="text-sm font-bold">
                            {schools.find(s => s.id === user.schoolId)?.name || 'No School'}
                          </span>
                        </div>
                        {user.role === 'student' && (
                          <div className="text-xs text-gray-400 ml-6 uppercase font-black tracking-widest">
                            {user.gradeLevel || 'No Grade'} {user.program ? `• ${user.program}` : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setEditingUser(user); setShowUserModal(true); }}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.uid)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* School Modal */}
      <AnimatePresence>
        {showSchoolModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-[#004275] font-headline">
                  {editingSchool ? 'Edit School' : 'Add New School'}
                </h2>
                <button onClick={() => setShowSchoolModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <form onSubmit={handleSaveSchool} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">School Name</label>
                  <input 
                    name="name"
                    required
                    defaultValue={editingSchool?.name}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#004275]/10"
                    placeholder="e.g. Stanford University"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Description</label>
                  <textarea 
                    name="description"
                    defaultValue={editingSchool?.description}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#004275]/10 h-24"
                    placeholder="Brief description of the school..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Domain (Optional)</label>
                    <input 
                      name="domain"
                      defaultValue={editingSchool?.domain}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#004275]/10"
                      placeholder="stanford.edu"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Brand Color</label>
                    <input 
                      name="color"
                      type="color"
                      defaultValue={editingSchool?.color || '#004275'}
                      className="w-full h-[50px] bg-gray-50 border border-gray-200 rounded-xl px-2 py-1 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Logo URL (Optional)</label>
                  <input 
                    name="logoUrl"
                    defaultValue={editingSchool?.logoUrl}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#004275]/10"
                    placeholder="https://..."
                  />
                </div>
                
                <button 
                  type="submit"
                  className="w-full mt-6 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg active:scale-95"
                >
                  {editingSchool ? 'Update School' : 'Create School'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-[#004275] font-headline">Manage User</h2>
                <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-2xl">
                <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden">
                  {editingUser?.photoURL ? <img src={editingUser.photoURL} alt="" /> : <div className="w-full h-full bg-[#004275]" />}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{editingUser?.displayName || 'Unnamed'}</p>
                  <p className="text-sm text-gray-500">{editingUser?.email}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-6">
                {isSuperAdmin && (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Assigned School</label>
                    <select 
                      name="schoolId"
                      defaultValue={editingUser?.schoolId || ''}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#004275]/10 font-bold"
                    >
                      <option value="">No School Assigned</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">User Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['student', 'teacher', 'admin'].map(r => (
                      <label key={r} className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 cursor-pointer transition-all font-bold uppercase tracking-widest text-[10px]
                        ${editingUser?.role === r ? 'border-[#004275] bg-[#004275]/5 text-[#004275]' : 'border-gray-100 text-gray-400 hover:border-gray-200'}
                      `}>
                        <input 
                          type="radio" 
                          name="role" 
                          value={r} 
                          className="hidden" 
                          defaultChecked={editingUser?.role === r}
                          onChange={(e) => setEditingUser(prev => prev ? {...prev, role: e.target.value as any} : null)}
                        />
                        {r === 'admin' ? <Shield className="w-4 h-4" /> : r === 'teacher' ? <Users className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                        {r}
                      </label>
                    ))}
                  </div>
                </div>

                {editingUser?.role === 'student' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Grade Level</label>
                        <input 
                          name="gradeLevel"
                          defaultValue={editingUser?.gradeLevel}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                          placeholder="e.g. 10th Grade"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Program</label>
                        <input 
                          name="program"
                          defaultValue={editingUser?.program}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                          placeholder="e.g. IB Program"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">GPA</label>
                        <input 
                          name="gpa"
                          defaultValue={editingUser?.gpa}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                          placeholder="3.85"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Graduation Year</label>
                        <input 
                          name="graduationYear"
                          defaultValue={editingUser?.graduationYear}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                          placeholder="2026"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Student Phone</label>
                        <input 
                          name="phone"
                          defaultValue={editingUser?.phone}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                          placeholder="(555) 000-0000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Locker #</label>
                        <input 
                          name="lockerNumber"
                          defaultValue={editingUser?.lockerNumber}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                          placeholder="B-101"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Guardian Contact</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input name="guardianName" defaultValue={editingUser?.guardianName} placeholder="Name" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                        <input name="guardianPhone" defaultValue={editingUser?.guardianPhone} placeholder="Phone" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                      </div>
                    </div>
                  </>
                )}
                
                <button 
                  type="submit"
                  className="w-full mt-6 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg active:scale-95"
                >
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Student Profile Modal */}
      <AnimatePresence>
        {showStudentModal && selectedStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-2xl p-0 shadow-2xl overflow-hidden"
            >
              <div className="bg-[#004275] p-10 text-white relative">
                <button 
                  onClick={() => setShowStudentModal(false)} 
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-3xl bg-white/10 border-4 border-white/20 flex items-center justify-center text-4xl font-black">
                    {selectedStudent.displayName?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black font-headline">{selectedStudent.displayName}</h2>
                    <p className="text-blue-100 font-medium">{selectedStudent.email}</p>
                    <div className="flex gap-2 mt-3">
                      <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {selectedStudent.gradeLevel || 'Level N/A'}
                      </span>
                      <span className="px-3 py-1 bg-green-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                        Active Student
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 grid grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Academic Overview</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <p className="text-2xl font-black text-[#004275]">3.85</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current GPA</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <p className="text-2xl font-black text-[#004275]">12/240</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Class Rank</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Enrollment Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Program</span>
                        <span className="font-bold text-[#1a1c1c]">{selectedStudent.program || 'Standard Curriculum'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Graduation Year</span>
                        <span className="font-bold text-[#1a1c1c]">2026</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Entry Date</span>
                        <span className="font-bold text-[#1a1c1c]">Sept 2022</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 border-l border-gray-100 pl-10">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Guardians & Contact</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Sarah {selectedStudent.displayName?.split(' ').pop()}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Mother / Primary</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-gray-100">
                    <button className="w-full py-3 bg-gray-50 text-[#004275] border border-[#004275]/10 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all">
                      View Full Transcript
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedStudent(selectedStudent);
                        setShowDisciplineModal(true);
                      }}
                      className="w-full mt-3 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
                    >
                      Log Disciplinary Action
                    </button>
                  </div>
                </div>

                  <div className="md:col-span-1 space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-200">
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Personal Info</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Phone</span>
                          <span className="font-bold">{selectedStudent.phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Locker</span>
                          <span className="font-bold">{selectedStudent.lockerNumber || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-10 border-t border-gray-100 flex justify-between gap-4">
                  <div className="flex gap-4">
                    <button className="bg-gray-100 text-[#004275] px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">
                      View Transcript
                    </button>
                    <button 
                      onClick={() => setShowDisciplineModal(true)}
                      className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-all"
                    >
                      Referral
                    </button>
                  </div>
                  <button 
                    onClick={() => handleDeleteUser(selectedStudent.uid, selectedStudent.isStaident)}
                    className="flex items-center gap-2 bg-red-500 text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                  >
                    Withdraw Student
                  </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Discipline Referral Modal */}
      <AnimatePresence>
        {showDisciplineModal && selectedStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] w-full max-w-lg p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-900 font-headline">New Discipline Referral</h3>
                <button onClick={() => setShowDisciplineModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex items-center gap-4 mb-6 p-4 bg-red-50 rounded-2xl border border-red-100">
                <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center font-black">
                  {selectedStudent.displayName?.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-red-900">{selectedStudent.displayName}</p>
                  <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">Incident Report</p>
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddReferral(
                  selectedStudent, 
                  formData.get('type') as string, 
                  formData.get('description') as string
                );
                setShowDisciplineModal(false);
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Severity Level</label>
                  <select name="type" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none font-bold">
                    <option value="MINOR">Minor (Warning/Classroom)</option>
                    <option value="MODERATE">Moderate (Detention)</option>
                    <option value="MAJOR">Major (Suspension/Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Incident Description</label>
                  <textarea 
                    name="description" 
                    required 
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-sm"
                    placeholder="Describe what happened with as much detail as possible..."
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-sm hover:bg-red-700 transition-all shadow-lg active:scale-95"
                >
                  Submit Referral
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-[#004275] font-headline">Add New User</h2>
                <button onClick={() => setShowAddUserModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Full Name</label>
                  <input name="displayName" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                  <input name="email" type="email" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Role</label>
                  <select name="role" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none font-bold">
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Grade (Student only)</label>
                    <input name="gradeLevel" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="10th" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Program (Student only)</label>
                    <input name="program" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="AP" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">GPA</label>
                    <input name="gpa" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="3.8" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Grad Year</label>
                    <input name="graduationYear" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="2026" />
                  </div>
                </div>
                <button type="submit" className="w-full mt-6 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg active:scale-95">
                  Create User Account
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
