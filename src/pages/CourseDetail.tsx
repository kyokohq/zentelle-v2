import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Course, Activity, Resource, OperationType, Enrollment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import Materials from './Materials';
import Gradebook from '../components/Gradebook';
import { 
  Megaphone, 
  FileText, 
  MessageSquare, 
  ArrowLeft, 
  Send, 
  Plus, 
  MoreVertical,
  ExternalLink,
  FileIcon,
  VideoIcon,
  LinkIcon,
  User,
  X,
  FolderOpen,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

export function CourseDetail({ userRole }: { userRole?: string }) {
  const { courseId, tab, folderId } = useParams<{ courseId: string, tab?: string, folderId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const activeTab = (tab as any) || 'updates';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({ title: '', content: '' });
  const [fileForm, setFileForm] = useState({ title: '', category: '', type: 'pdf' as 'pdf' | 'video' | 'link', url: '' });

  useEffect(() => {
    if (!courseId || !auth.currentUser) return;

    const fetchData = async () => {
      try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (courseDoc.exists()) {
          setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
        } else {
          navigate('/courses');
          return;
        }

        // Fetch enrollment for grade
        const enrollDoc = await getDoc(doc(db, 'enrollments', `${auth.currentUser.uid}_${courseId}`));
        if (enrollDoc.exists()) {
          setEnrollment({ id: enrollDoc.id, ...enrollDoc.data() } as Enrollment);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen for activities (updates)
    const qActivities = query(
      collection(db, 'activities'), 
      where('courseId', '==', courseId),
      orderBy('timestamp', 'desc')
    );
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    });

    // Listen for resources (files)
    const qResources = query(
      collection(db, 'resources'), 
      where('courseId', '==', courseId)
    );
    const unsubResources = onSnapshot(qResources, (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
    });

    // Listen for messages (chat)
    const qMessages = query(
      collection(db, 'course_messages'), 
      where('courseId', '==', courseId),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubActivities();
      unsubResources();
      unsubMessages();
    };
  }, [courseId, navigate]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !courseId) return;

    try {
      await addDoc(collection(db, 'course_messages'), {
        courseId,
        text: newMessage,
        uid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        authorPhoto: auth.currentUser.photoURL,
        timestamp: new Date().toISOString()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#004275] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <button 
        onClick={() => navigate('/courses')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#004275] font-bold transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Courses
      </button>

      <div className={`relative h-64 rounded-3xl overflow-hidden ${course.color} shadow-lg`}>
        <img 
          src={course.image} 
          alt={course.title}
          className="w-full h-full object-cover mix-blend-overlay opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <span className="bg-white/20 backdrop-blur-md text-white text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md border border-white/20 mb-3 inline-block">
              {course.tag}
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white font-headline leading-tight">{course.title}</h1>
            <p className="text-white/80 font-medium mt-1">{course.section} • {course.instructor}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center min-w-[120px]">
            <span className="block text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">Current Grade</span>
            <span className="text-3xl font-black text-white">{enrollment?.grade || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
        <TabButton 
          active={activeTab === 'updates'} 
          onClick={() => navigate(`/courses/${courseId}/updates`)} 
          icon={<Megaphone className="w-4 h-4" />} 
          label="Updates" 
        />
        <TabButton 
          active={activeTab === 'materials'} 
          onClick={() => navigate(`/courses/${courseId}/materials`)} 
          icon={<FolderOpen className="w-4 h-4" />} 
          label="Materials" 
        />
        <TabButton 
          active={activeTab === 'files'} 
          onClick={() => navigate(`/courses/${courseId}/files`)} 
          icon={<FileText className="w-4 h-4" />} 
          label="Files" 
        />
        <TabButton 
          active={activeTab === 'chat'} 
          onClick={() => navigate(`/courses/${courseId}/chat`)} 
          icon={<MessageSquare className="w-4 h-4" />} 
          label="Discussion" 
        />
        <TabButton 
          active={activeTab === 'grades'} 
          onClick={() => navigate(`/courses/${courseId}/grades`)} 
          icon={<CheckCircle2 className="w-4 h-4" />} 
          label="Grades" 
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm min-h-[500px] overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'updates' && (
            <motion.div 
              key="updates"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-[#1a1c1c] font-headline">Recent Announcements</h2>
                <button 
                  onClick={() => setShowUpdateModal(true)}
                  className="text-sm font-bold text-[#004275] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  New Update
                </button>
              </div>
              
              <div className="space-y-4">
                {activities.length > 0 ? activities.map((activity) => (
                  <div key={activity.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:border-[#004275]/30 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#004275]/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[#004275]" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#1a1c1c]">{activity.authorName}</h4>
                          <p className="text-xs text-gray-400 font-medium">{new Date(activity.timestamp).toLocaleDateString()} • {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{activity.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{activity.content}</p>
                  </div>
                )) : (
                  <div className="text-center py-20">
                    <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">No announcements yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'materials' && (
            <motion.div 
              key="materials"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8"
            >
              <Materials 
                userRole={userRole} 
                courseId={courseId} 
                folderId={folderId} 
                onNavigate={(path) => navigate(path)}
                hideHeader={true}
              />
            </motion.div>
          )}

          {activeTab === 'files' && (
            <motion.div 
              key="files"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-[#1a1c1c] font-headline">Course Resources</h2>
                <button 
                  onClick={() => setShowFileModal(true)}
                  className="bg-[#004275] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#005a9c] transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Upload File
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.length > 0 ? resources.map((resource) => (
                  <a 
                    key={resource.id} 
                    href={resource.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-[#004275] hover:shadow-md transition-all group"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      resource.type === 'pdf' ? 'bg-red-50 text-red-500' : 
                      resource.type === 'video' ? 'bg-blue-50 text-blue-500' : 
                      'bg-green-50 text-green-500'
                    }`}>
                      {resource.type === 'pdf' && <FileIcon className="w-6 h-6" />}
                      {resource.type === 'video' && <VideoIcon className="w-6 h-6" />}
                      {resource.type === 'link' && <LinkIcon className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[#1a1c1c] truncate group-hover:text-[#004275] transition-colors">{resource.title}</h4>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{resource.category} • {resource.type}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-[#004275]" />
                  </a>
                )) : (
                  <div className="col-span-full text-center py-20">
                    <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">No resources uploaded for this course.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-[600px]"
            >
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.length > 0 ? messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-4 ${msg.uid === auth.currentUser?.uid ? 'flex-row-reverse' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                      {msg.authorPhoto ? (
                        <img src={msg.authorPhoto} alt={msg.authorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#004275] text-white font-bold text-xs">
                          {msg.authorName[0]}
                        </div>
                      )}
                    </div>
                    <div className={`max-w-[70%] ${msg.uid === auth.currentUser?.uid ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-bold text-gray-900">{msg.authorName}</span>
                        <span className="text-[10px] font-medium text-gray-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`p-4 rounded-2xl text-sm font-medium ${
                        msg.uid === auth.currentUser?.uid 
                          ? 'bg-[#004275] text-white rounded-tr-none' 
                          : 'bg-gray-100 text-gray-800 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20">
                    <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">Start a discussion with your classmates!</p>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSendMessage} className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <input 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-[#004275] text-white p-3 rounded-xl hover:bg-[#005a9c] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === 'grades' && (
            <motion.div 
              key="grades"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8"
            >
              <Gradebook courseId={courseId!} isAdmin={userRole === 'admin'} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New Update Modal */}
      <AnimatePresence>
        {showUpdateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-[#1a1c1c] font-headline">Post New Update</h3>
                <button onClick={() => setShowUpdateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!auth.currentUser || !courseId) return;
                try {
                  await addDoc(collection(db, 'activities'), {
                    type: 'announcement',
                    title: updateForm.title,
                    content: updateForm.content,
                    timestamp: new Date().toISOString(),
                    courseId,
                    uid: auth.currentUser.uid,
                    authorName: auth.currentUser.displayName || 'Instructor'
                  });
                  setShowUpdateModal(false);
                  setUpdateForm({ title: '', content: '' });
                } catch (error) {
                  console.error('Error posting update:', error);
                }
              }} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Update Title</label>
                  <input 
                    required
                    type="text"
                    value={updateForm.title}
                    onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })}
                    placeholder="e.g., Midterm Exam Date Changed"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Content</label>
                  <textarea 
                    required
                    rows={4}
                    value={updateForm.content}
                    onChange={(e) => setUpdateForm({ ...updateForm, content: e.target.value })}
                    placeholder="Provide more details about this update..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all resize-none"
                  />
                </div>
                <button type="submit" className="w-full bg-[#004275] text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#005a9c] transition-all shadow-lg shadow-[#004275]/20">
                  Post Announcement
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload File Modal */}
      <AnimatePresence>
        {showFileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-[#1a1c1c] font-headline">Upload Resource</h3>
                <button onClick={() => setShowFileModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!auth.currentUser || !courseId) return;
                try {
                  await addDoc(collection(db, 'resources'), {
                    ...fileForm,
                    courseId,
                    uid: auth.currentUser.uid
                  });
                  setShowFileModal(false);
                  setFileForm({ title: '', category: '', type: 'pdf', url: '' });
                } catch (error) {
                  console.error('Error uploading resource:', error);
                }
              }} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Resource Title</label>
                  <input 
                    required
                    type="text"
                    value={fileForm.title}
                    onChange={(e) => setFileForm({ ...fileForm, title: e.target.value })}
                    placeholder="e.g., Syllabus 2024"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Category</label>
                    <input 
                      required
                      type="text"
                      value={fileForm.category}
                      onChange={(e) => setFileForm({ ...fileForm, category: e.target.value })}
                      placeholder="e.g., Lectures"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Type</label>
                    <select 
                      value={fileForm.type}
                      onChange={(e) => setFileForm({ ...fileForm, type: e.target.value as any })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                    >
                      <option value="pdf">PDF</option>
                      <option value="video">Video</option>
                      <option value="link">Link</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">URL / Link</label>
                  <input 
                    required
                    type="url"
                    value={fileForm.url}
                    onChange={(e) => setFileForm({ ...fileForm, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all"
                  />
                </div>
                <button type="submit" className="w-full bg-[#004275] text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#005a9c] transition-all shadow-lg shadow-[#004275]/20">
                  Upload Resource
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
        active 
          ? 'bg-[#004275] text-white shadow-md' 
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
