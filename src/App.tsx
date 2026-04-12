/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDoc,
  getDocs,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  Course, 
  Activity, 
  Reminder, 
  Event, 
  Task, 
  Group, 
  Resource,
  OperationType, 
  FirestoreErrorInfo,
  UserProfile
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Auth } from './components/Auth';
import { Dashboard } from './pages/Dashboard';
import { Courses } from './pages/Courses';
import { CourseDetail } from './pages/CourseDetail';
import { Calendar } from './pages/Calendar';
import { Grades } from './pages/Grades';
import { Attendance } from './pages/Attendance';
import { Groups } from './pages/Groups';
import { Resources } from './pages/Resources';
import Materials from './pages/Materials';
import AssignmentDetail from './pages/AssignmentDetail';
import { Loader2, LogIn, X } from 'lucide-react';

// --- Error Handling ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ZentelleApp />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function ZentelleApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showUploadResource, setShowUploadResource] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (!firebaseUser) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!isAuthReady || !user) return;

    setLoading(true);
    const uid = user.uid;

    // Sync User Profile
    const syncProfile = async () => {
      const userRef = doc(db, 'users', uid);
      try {
        const userSnap = await getDoc(userRef);
        const isAdminUser = uid === 'shanesdih' || user.email === 'piercesnyder39@gmail.com';
        
        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid,
            displayName: user.displayName || 'Student',
            email: user.email || '',
            photoURL: user.photoURL || null,
            role: isAdminUser ? 'admin' : 'student'
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
          await seedInitialData(uid);
        } else {
          const profile = userSnap.data() as UserProfile;
          // If user should be admin but isn't, update them
          if (isAdminUser && profile.role !== 'admin') {
            const updatedProfile = { ...profile, role: 'admin' as const };
            await setDoc(userRef, updatedProfile);
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(profile);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      }
    };
    syncProfile();

    // Listeners
    const qEnrollments = query(collection(db, 'enrollments'), where('uid', '==', uid));
    const unsubEnrollments = onSnapshot(qEnrollments, async (snapshot) => {
      const enrolledCourseIds = snapshot.docs.map(doc => doc.data().courseId);
      if (enrolledCourseIds.length === 0) {
        setCourses([]);
        return;
      }
      
      const qCourses = query(collection(db, 'courses'), where('__name__', 'in', enrolledCourseIds));
      const unsubCourses = onSnapshot(qCourses, (cSnapshot) => {
        setCourses(cSnapshot.docs.map(doc => {
          const enrollment = snapshot.docs.find(e => e.data().courseId === doc.id);
          return { id: doc.id, ...doc.data(), grade: enrollment?.data().grade || 'N/A' } as Course;
        }));
      });
      return () => unsubCourses();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments'));

    const qActivities = query(collection(db, 'activities'), orderBy('timestamp', 'desc'));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'activities'));

    const qReminders = query(collection(db, 'reminders'), where('uid', '==', uid));
    const unsubReminders = onSnapshot(qReminders, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reminders'));

    const qEvents = query(collection(db, 'events'), where('uid', '==', uid));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));

    const qTasks = query(collection(db, 'tasks'), where('uid', '==', uid));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    const qGroups = query(collection(db, 'groups'), where('uid', '==', uid));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'groups'));

    const qResources = query(collection(db, 'resources'));
    const unsubResources = onSnapshot(qResources, (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'resources'));

    return () => {
      unsubEnrollments();
      unsubActivities();
      unsubReminders();
      unsubEvents();
      unsubTasks();
      unsubGroups();
      unsubResources();
    };
  }, [isAuthReady, user]);

  const seedInitialData = async (uid: string) => {
    const initialCourses = [
      { title: "AP Biology", instructor: "Dr. Aris Thorne", section: "Section 4", tag: "Science", color: "bg-[#004275]", image: "https://picsum.photos/seed/biology/800/400", code: "BIO101" },
      { title: "World History", instructor: "Prof. Marcus Lee", section: "Section 1", tag: "Humanities", color: "bg-[#6a3100]", image: "https://picsum.photos/seed/history/800/400", code: "HIS202" },
      { title: "English 10 Honors", instructor: "Ms. Sarah Jenkins", section: "Section 2", tag: "Language", color: "bg-[#005a9c]", image: "https://picsum.photos/seed/literature/800/400", code: "ENG303" }
    ];
    
    const courseIds: string[] = [];
    for (const c of initialCourses) {
      const docRef = await addDoc(collection(db, 'courses'), c);
      courseIds.push(docRef.id);
      // Enroll user in these courses
      await setDoc(doc(db, 'enrollments', `${uid}_${docRef.id}`), {
        uid,
        courseId: docRef.id,
        grade: Math.floor(Math.random() * 20 + 80) + "%"
      });
    }

    const initialActivities = [
      { type: "announcement", title: "Dr. Aris Thorne posted a new announcement", content: '"Please share your initial findings from the osmosis lab by end of day..."', timestamp: new Date().toISOString(), uid: "system", authorName: "Dr. Aris Thorne", courseId: courseIds[0] },
      { type: "grade_update", title: "Grade updated for Unit 3 Quiz", content: "Score: 28/30 (93%) • Great work on the essay portion!", timestamp: new Date().toISOString(), uid: "system", authorName: "System", courseId: courseIds[1] }
    ];
    for (const a of initialActivities) {
      await addDoc(collection(db, 'activities'), a);
    }

    const initialResources = [
      { title: "Lab Report Template", category: "Science", type: "pdf", url: "https://example.com/template.pdf", courseId: courseIds[0], uid: "system" },
      { title: "Unit 4 Reading List", category: "Language", type: "link", url: "https://example.com/reading", courseId: courseIds[2], uid: "system" }
    ];
    for (const r of initialResources) {
      await addDoc(collection(db, 'resources'), r);
    }

    const initialReminders = [
      { title: "Homework 3 due tomorrow", subtitle: "AP Biology • 11:59 PM", color: "bg-[#ba1a1a]", dueDate: new Date().toISOString(), uid },
      { title: "Unit 4 Reading", subtitle: "English 10 • In 2 days", color: "bg-[#6a3100]", dueDate: new Date().toISOString(), uid }
    ];
    for (const r of initialReminders) {
      await addDoc(collection(db, 'reminders'), r);
    }

    const initialEvents = [
      { title: "Medieval Europe Test", subtitle: "World History • Period 3", date: "25", day: "Friday", month: "Oct 25", color: "bg-[#d2e4ff]", textColor: "text-[#004275]", uid },
      { title: "Science Fair Check-in", subtitle: "AP Biology • Library", date: "28", day: "Monday", month: "Oct 28", color: "bg-[#c9deff]", textColor: "text-[#4d627e]", uid }
    ];
    for (const e of initialEvents) {
      await addDoc(collection(db, 'events'), e);
    }
  };

  const handleJoinCourse = async (courseCode: string) => {
    if (!user) return;
    try {
      const q = query(collection(db, 'courses'), where('code', '==', courseCode.toUpperCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("Course code not found. Please try BIO101, HIS202, or ENG303.");
        return;
      }

      const courseId = snapshot.docs[0].id;
      
      // Check if already enrolled
      const qEnroll = query(collection(db, 'enrollments'), where('uid', '==', user.uid), where('courseId', '==', courseId));
      const enrollSnap = await getDocs(qEnroll);
      
      if (!enrollSnap.empty) {
        alert("You are already enrolled in this course.");
        setShowAddCourse(false);
        return;
      }

      await setDoc(doc(db, 'enrollments', `${user.uid}_${courseId}`), {
        uid: user.uid,
        courseId: courseId,
        grade: 'N/A'
      });
      setShowAddCourse(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'enrollments');
    }
  };

  const handleCreateCourse = async (courseData: any) => {
    if (!user) return;
    try {
      // Generate a unique course code
      const code = courseData.code.toUpperCase();
      const q = query(collection(db, 'courses'), where('code', '==', code));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        alert("A course with this code already exists.");
        return;
      }

      const docRef = await addDoc(collection(db, 'courses'), {
        ...courseData,
        code,
        uid: user.uid // Track creator
      });

      // Automatically enroll the creator
      await setDoc(doc(db, 'enrollments', `${user.uid}_${docRef.id}`), {
        uid: user.uid,
        courseId: docRef.id,
        grade: 'N/A'
      });

      setShowCreateCourse(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const handleAddTask = async (taskData: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        status: 'pending',
        uid: user.uid
      });
      // Also add a reminder
      await addDoc(collection(db, 'reminders'), {
        title: taskData.title,
        subtitle: taskData.courseId || 'General Task',
        color: 'bg-[#004275]',
        dueDate: taskData.dueDate,
        uid: user.uid
      });
      setShowAddTask(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
    }
  };

  const handleAddEvent = async (eventData: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'events'), {
        ...eventData,
        uid: user.uid
      });
      setShowAddEvent(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'events');
    }
  };

  const handleCreateGroup = async (groupData: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'groups'), {
        ...groupData,
        members: [user.uid],
        uid: user.uid
      });
      setShowCreateGroup(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'groups');
    }
  };

  const handleUploadResource = async (resourceData: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'resources'), {
        ...resourceData,
        uid: user.uid
      });
      setShowUploadResource(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'resources');
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    try {
      await setDoc(doc(db, 'tasks', task.id), {
        ...task,
        status: task.status === 'pending' ? 'completed' : 'pending'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reminders/${id}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9]">
        <Loader2 className="w-10 h-10 text-[#004275] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9f9f9] p-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-[#004275] mb-4 font-headline">Zentelle</h1>
            <p className="text-gray-600">Your modern educational dashboard. Please sign in to continue.</p>
          </div>
          <Auth />
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} onAddTask={() => setShowAddTask(true)}>
      <Routes>
        <Route path="/" element={
          <Dashboard 
            user={user} 
            userRole={userProfile?.role}
            courses={courses} 
            activities={activities} 
            reminders={reminders} 
            events={events} 
            tasks={tasks}
            loading={loading}
            onJoinCourse={() => setShowAddCourse(true)}
            onCreateCourse={() => setShowCreateCourse(true)}
            onDeleteReminder={deleteReminder}
            onDeleteTask={deleteTask}
            onToggleTask={toggleTaskStatus}
          />
        } />
        <Route path="/courses" element={<Courses courses={courses} userRole={userProfile?.role} onJoinCourse={() => setShowAddCourse(true)} onCreateCourse={() => setShowCreateCourse(true)} />} />
        <Route path="/courses/:courseId" element={<CourseDetail userRole={userProfile?.role} />} />
        <Route path="/courses/:courseId/:tab" element={<CourseDetail userRole={userProfile?.role} />} />
        <Route path="/courses/:courseId/:tab/:folderId" element={<CourseDetail userRole={userProfile?.role} />} />
        <Route path="/courses/:courseId/assignments/:assignmentId" element={<AssignmentDetail userRole={userProfile?.role} />} />
        <Route path="/calendar" element={<Calendar events={events} onAddEvent={() => setShowAddEvent(true)} />} />
        <Route path="/grades" element={<Grades courses={courses} />} />
        <Route path="/attendance" element={<Attendance courses={courses} />} />
        <Route path="/groups" element={<Groups groups={groups} onCreateGroup={() => setShowCreateGroup(true)} />} />
        <Route path="/resources" element={<Resources resources={resources} onUploadResource={() => setShowUploadResource(true)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Modals */}
      {showAddTask && (
        <AddTaskModal 
          courses={courses} 
          onClose={() => setShowAddTask(false)} 
          onSubmit={handleAddTask} 
        />
      )}
      {showAddCourse && (
        <JoinCourseModal 
          onClose={() => setShowAddCourse(false)} 
          onSubmit={handleJoinCourse} 
        />
      )}
      {showCreateCourse && (
        <CreateCourseModal 
          onClose={() => setShowCreateCourse(false)} 
          onSubmit={handleCreateCourse} 
        />
      )}
      {showAddEvent && (
        <AddEventModal 
          onClose={() => setShowAddEvent(false)} 
          onSubmit={handleAddEvent} 
        />
      )}
      {showCreateGroup && (
        <CreateGroupModal 
          onClose={() => setShowCreateGroup(false)} 
          onSubmit={handleCreateGroup} 
        />
      )}
      {showUploadResource && (
        <UploadResourceModal 
          onClose={() => setShowUploadResource(false)} 
          onSubmit={handleUploadResource} 
        />
      )}
    </Layout>
  );
}

function AddTaskModal({ courses, onClose, onSubmit }: { courses: Course[], onClose: () => void, onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [dueDate, setDueDate] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#004275] font-headline">Create New Task</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title, courseId, dueDate }); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Task Title</label>
              <input 
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                placeholder="e.g. Finish Lab Report"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Course (Optional)</label>
              <select 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">General</option>
                {courses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Due Date</label>
              <input 
                required
                type="datetime-local"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full mt-8 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg"
          >
            Create Task
          </button>
        </form>
      </div>
    </div>
  );
}

function CreateCourseModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [section, setSection] = useState('');
  const [tag, setTag] = useState('');
  const [code, setCode] = useState('');
  const [image, setImage] = useState('https://picsum.photos/seed/course/800/600');

  const colors = ['bg-[#004275]', 'bg-[#4d627e]', 'bg-[#1a1c1c]', 'bg-[#005a9c]'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl my-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#004275] font-headline">Create New Course</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          onSubmit({ 
            title, 
            instructor, 
            section, 
            tag, 
            code, 
            image,
            color: colors[Math.floor(Math.random() * colors.length)]
          }); 
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Course Title</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Advanced Organic Chemistry" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Instructor</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Dr. Sarah Miller" value={instructor} onChange={(e) => setInstructor(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Section</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Period 2" value={section} onChange={(e) => setSection(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Tag/Category</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Science" value={tag} onChange={(e) => setTag(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Course Code</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none font-mono uppercase" placeholder="e.g. CHEM301" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Cover Image URL</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="https://..." value={image} onChange={(e) => setImage(e.target.value)} />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full mt-8 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg"
          >
            Create Course
          </button>
        </form>
      </div>
    </div>
  );
}

function JoinCourseModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#004275] font-headline">Join a Course</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <p className="text-gray-500 text-sm mb-6">Enter the course code provided by your instructor to enroll.</p>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(code); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Course Code</label>
              <input 
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all font-mono uppercase"
                placeholder="e.g. BIO101"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full mt-8 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg"
          >
            Join Course
          </button>
        </form>
      </div>
    </div>
  );
}

function AddEventModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [date, setDate] = useState('');

  const colors = ['bg-[#d2e4ff]', 'bg-[#c9deff]', 'bg-[#ffdcc7]', 'bg-[#f5f5f5]'];
  const textColors = ['text-[#004275]', 'text-[#4d627e]', 'text-[#311300]', 'text-gray-600'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#004275] font-headline">Add New Event</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          const d = new Date(date);
          onSubmit({ 
            title, 
            subtitle, 
            date: d.getDate().toString(), 
            day: d.toLocaleString('default', { weekday: 'long' }),
            month: d.toLocaleString('default', { month: 'short' }) + ' ' + d.getDate(),
            color: colors[Math.floor(Math.random() * colors.length)],
            textColor: textColors[Math.floor(Math.random() * textColors.length)]
          }); 
        }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Title</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Math Competition" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Details</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Period 4 • Room 202" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Date</label>
              <input required type="date" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="w-full mt-8 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] shadow-lg">Add Event</button>
        </form>
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (data: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#004275] font-headline">Create Study Group</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, description }); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Group Name</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Physics Study Squad" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Description</label>
              <textarea required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" rows={3} placeholder="What is this group about?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="w-full mt-8 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] shadow-lg">Create Group</button>
        </form>
      </div>
    </div>
  );
}

function UploadResourceModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Science');
  const [type, setType] = useState<'pdf' | 'video' | 'link'>('pdf');
  const [url, setUrl] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-[#004275] font-headline">Upload Resource</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title, category, type, url }); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Resource Title</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="e.g. Biology Lab Notes" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Category</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Science</option>
                  <option>Math</option>
                  <option>Humanities</option>
                  <option>Language</option>
                  <option>Arts</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Type</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" value={type} onChange={(e) => setType(e.target.value as any)}>
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">URL / Link</label>
              <input required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="w-full mt-8 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] shadow-lg">Upload Resource</button>
        </form>
      </div>
    </div>
  );
}
