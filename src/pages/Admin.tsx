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
import { School, UserProfile } from '../types';
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
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Admin({ currentUserId, currentSchoolId, userEmail }: { currentUserId: string, currentSchoolId: string | null, userEmail: string | null }) {
  const [activeTab, setActiveTab] = useState<'users' | 'schools' | 'settings'>('users');
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const isSuperAdmin = currentUserId === 'shanesdih' || userEmail === 'piercesnyder39@gmail.com';

  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

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

    setLoading(false);

    return () => {
      unsubSchools();
      unsubUsers();
    };
  }, [isSuperAdmin, currentSchoolId]);

  const handleSaveSchool = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      program: formData.get('program') as string || ''
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
      program: formData.get('program') as string || ''
    };

    try {
      await setDoc(doc(db, 'users', editingUser.uid), updatedUser);
      setShowUserModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
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
        
        <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'users' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Users className="w-4 h-4" /> Users
          </button>
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveTab('schools')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'schools' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <SchoolIcon className="w-4 h-4" /> Schools
            </button>
          )}
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'settings' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
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
                {filteredSchools.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No schools found. Create one to get started!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                      <button 
                        onClick={() => { setEditingUser(user); setShowUserModal(true); }}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
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
