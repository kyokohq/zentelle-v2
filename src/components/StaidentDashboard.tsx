import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Staident, Material, Submission } from '../types';
import { useDialog } from '../context/DialogContext';
import { StaidentService } from '../services/staidentService';
import { 
  Users, 
  Cpu, 
  Play, 
  Settings, 
  BarChart2, 
  TrendingUp, 
  AlertCircle,
  Plus,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  BrainCircuit,
  MessageCircle,
  Send,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { StaidentMessage } from '../types';

interface StaidentDashboardProps {
  courseId: string;
  staidents: Staident[];
}

export function StaidentDashboard({ courseId, staidents }: StaidentDashboardProps) {
  const { showAlert, showConfirm } = useDialog();
  const [activeSubTab, setActiveSubTab] = useState<'manage' | 'simulate' | 'analytics' | 'messages'>('manage');
  const [assignments, setAssignments] = useState<Material[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [simulationDelay, setSimulationDelay] = useState(10); // Default 10 seconds
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Messaging state
  const [selectedStaident, setSelectedStaident] = useState<Staident | null>(null);
  const [messages, setMessages] = useState<StaidentMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [staidentCount, setStaidentCount] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!courseId) return;

    // Fetch assignments
    const fetchAssignments = async () => {
      try {
        const q = query(
          collection(db, 'materials'), 
          where('courseId', '==', courseId),
          where('type', '==', 'assignment')
        );
        const snap = await getDocs(q);
        setAssignments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
      } catch (error) {
        console.error("Error fetching assignments:", error);
      }
    };
    fetchAssignments();

    // Listen for simulated submissions
    const qSub = query(
      collection(db, 'submissions'),
      where('isSimulated', '==', true)
    );
    const unsubSubmissions = onSnapshot(qSub, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });

    return () => unsubSubmissions();
  }, [courseId]);

  useEffect(() => {
    if (!selectedStaident?.id || !courseId) {
      setMessages([]);
      return;
    }

    const qMsg = query(
      collection(db, 'staident_messages'),
      where('staidentId', '==', selectedStaident.id),
      where('courseId', '==', courseId)
    );

    const unsubMessages = onSnapshot(qMsg, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaidentMessage));
      setMessages(msgs.sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
        return timeA - timeB;
      }));
    });

    return () => unsubMessages();
  }, [selectedStaident, courseId]);

  const handleAddStaidents = async () => {
    setIsProcessing(true);
    try {
      // Get schoolId if possible
      const schoolId = (auth.currentUser as any)?.schoolId || '';
      await StaidentService.addStaidentsToCourse(courseId, staidentCount, schoolId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveStaidents = async () => {
    if (staidents.length === 0) {
      await showAlert("No AI students in this course to remove.", "Info");
      return;
    }
    
    // Default to removing all if count is accidentally too high or user just wants to clear
    const countToRemove = Math.min(staidentCount, staidents.length);
    
    if (!await showConfirm(`Are you sure you want to remove ${countToRemove} AI student(s)?`, "Remove AI Students")) return;
    setIsProcessing(true);
    try {
      const removedCount = await StaidentService.removeStaidentsFromCourse(courseId, countToRemove);
      await showAlert(`Successfully removed ${removedCount} AI student(s).`, "Success");
    } catch (error) {
      console.error("Removal error:", error);
      await showAlert("Failed to remove AI students. Check console for details.", "Error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveIndividualStaident = async (id: string, name: string) => {
    if (!await showConfirm(`Are you sure you want to remove ${name}?`, "Remove Student")) return;
    setIsProcessing(true);
    try {
      // We can use the same service or a new one
      // Let's add a single removal method to StaidentService
      await StaidentService.removeSingleStaident(id);
      await showAlert(`${name} has been removed.`, "Success");
    } catch (error) {
      console.error("Removal error:", error);
      await showAlert("Failed to remove student.", "Error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartSimulation = async () => {
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment || staidents.length === 0) return;

    setIsSimulating(true);
    setSimulationProgress(0);

    // Simulate!
    try {
      await StaidentService.runSimulation(assignment, staidents, simulationDelay);
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setIsSimulating(false);
      setSimulationProgress(100);
      setActiveSubTab('analytics');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedStaident || !auth.currentUser) return;

    const userMsg = newMessage;
    setNewMessage('');

    try {
      // 1. Save teacher message
      await addDoc(collection(db, 'staident_messages'), {
        staidentId: selectedStaident.id,
        courseId,
        text: userMsg,
        uid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Teacher',
        timestamp: serverTimestamp(),
        isFromStaident: false
      });

      // 2. Generate and save AI response
      setIsTyping(true);
      const history = messages.map(m => ({ text: m.text, isFromStaident: m.isFromStaident }));
      const response = await StaidentService.generateMessageResponse(selectedStaident, history, userMsg);
      
      await addDoc(collection(db, 'staident_messages'), {
        staidentId: selectedStaident.id,
        courseId,
        text: response,
        uid: `staident_${selectedStaident.id}`,
        authorName: selectedStaident.name,
        timestamp: serverTimestamp(),
        isFromStaident: true
      });
    } catch (error) {
      console.error("Send error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearAllSubmissions = async () => {
    if (!selectedAssignmentId) return;
    if (!await showConfirm("Are you sure you want to delete ALL submissions for this assignment? This cannot be undone.", "Delete Submissions")) return;
    
    setIsProcessing(true);
    try {
      const count = await StaidentService.deleteSubmissionsForMaterial(selectedAssignmentId);
      await showAlert(`Successfully deleted ${count} submission(s).`, "Success");
    } catch (error) {
      console.error("Deletion error:", error);
      await showAlert("Failed to delete submissions.", "Error");
    } finally {
      setIsProcessing(false);
    }
  };

  const assignmentSubmissions = submissions.filter(s => s.materialId === selectedAssignmentId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 font-headline flex items-center gap-3">
            <Cpu className="w-8 h-8 text-[#004275]" />
            Staident Training System
          </h2>
          <p className="text-gray-500">Practice classroom management with AI-powered students.</p>
        </div>
        
        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
          <button 
            onClick={() => setActiveSubTab('manage')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'manage' ? 'bg-white text-[#004275] shadow-sm shadow-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Manage
          </button>
          <button 
            onClick={() => setActiveSubTab('simulate')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'simulate' ? 'bg-white text-[#004275] shadow-sm shadow-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Simulate
          </button>
          <button 
            onClick={() => setActiveSubTab('analytics')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'analytics' ? 'bg-white text-[#004275] shadow-sm shadow-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Analytics
          </button>
          <button 
            onClick={() => setActiveSubTab('messages')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'messages' ? 'bg-white text-[#004275] shadow-sm shadow-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Messages
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'manage' && (
          <motion.div 
            key="manage"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
                  <Users className="w-5 h-5 text-gray-400" />
                  Staident Management
                </h3>
                <p className="text-sm text-gray-500">Configure the number of AI students in this section.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2">Count:</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="30"
                    value={staidentCount}
                    onChange={(e) => setStaidentCount(parseInt(e.target.value) || 1)}
                    className="w-16 bg-white border border-gray-200 rounded-xl px-2 py-2 text-center font-black text-[#004275] focus:ring-2 focus:ring-[#004275]/10 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleRemoveStaidents}
                    disabled={isProcessing || staidents.length === 0}
                    className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <button 
                    onClick={handleAddStaidents}
                    disabled={isProcessing}
                    className="bg-[#004275] text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#005a9c] transition-all shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add AI Students
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staidents.map(s => (
                <div key={s.id} className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-[#004275] flex items-center justify-center text-white text-xl font-black">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{s.name}</h4>
                      <p className="text-xs text-gray-400 uppercase font-black tracking-widest">{s.skillLevel} Level</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-bold uppercase tracking-widest">Behavior</span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md capitalize">{s.behaviorPattern}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{s.personality}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedStaident(s);
                        setActiveSubTab('messages');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#004275] hover:bg-[#004275]/5 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Message
                    </button>
                    <button 
                      onClick={() => handleRemoveIndividualStaident(s.id, s.name)}
                      disabled={isProcessing}
                      className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove Staident"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {staidents.length === 0 && (
                <div className="col-span-full py-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No Staidents in this course. Add some to start training!</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'simulate' && (
          <motion.div 
            key="simulate"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-[40px] border border-gray-100"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-white rounded-3xl shadow-xl border border-gray-100 flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-[#004275] fill-current" />
              </div>
              <h3 className="text-xl font-black text-gray-900 font-headline">Trigger Classroom Simulation</h3>
              <p className="text-gray-500 mt-1">Start a timed submission event for your AI students.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">Select Assignment</label>
                <select 
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-[#004275]/10 font-bold text-gray-900 appearance-none"
                >
                  <option value="">Choose an assignment...</option>
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Simulation Speed</label>
                  <span className="text-xs font-black text-[#004275] bg-[#004275]/10 px-2 py-1 rounded-md">{simulationDelay} Seconds</span>
                </div>
                <input 
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={simulationDelay}
                  onChange={(e) => setSimulationDelay(parseInt(e.target.value))}
                  className="w-full accent-[#004275]"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-black uppercase tracking-tighter">
                  <span>Fast (5s)</span>
                  <span>Natural (30s)</span>
                  <span>Realistic (60s)</span>
                </div>
              </div>

              {isSimulating ? (
                <div className="space-y-4 pt-4">
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-[#004275] h-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: simulationDelay, ease: "linear" }}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3 text-[#004275]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-black text-sm uppercase tracking-widest">Simulating classroom activity...</span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleStartSimulation}
                  disabled={!selectedAssignmentId || staidents.length === 0}
                  className="w-full bg-[#004275] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#005a9c] transition-all shadow-xl shadow-[#004275]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Launch Simulation
                </button>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'analytics' && (
          <motion.div 
            key="analytics"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Submissions" 
                value={assignmentSubmissions.length.toString()} 
                subtitle="From current simulation" 
                icon={<BarChart2 className="w-5 h-5" />} 
                color="blue"
              />
              <StatCard 
                title="Engagement" 
                value={`${Math.round((assignmentSubmissions.filter(s => s.status === 'submitted').length / assignmentSubmissions.length) * 100 || 0)}%`} 
                subtitle="Completion rate" 
                icon={<TrendingUp className="w-5 h-5" />} 
                color="green"
              />
              <StatCard 
                title="At Risk" 
                value={assignmentSubmissions.filter(s => s.status === 'draft').length.toString()} 
                subtitle="Missing submissions" 
                icon={<AlertCircle className="w-5 h-5" />} 
                color="red"
              />
              <StatCard 
                title="Avg Accuracy" 
                value="74%" 
                subtitle="Based on skill levels" 
                icon={<BrainCircuit className="w-5 h-5" />} 
                color="purple"
              />
            </div>

            <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="font-bold text-gray-900">Submission Log</h3>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-black">Assignment ID: {selectedAssignmentId || 'None Selected'}</p>
                </div>
                <div className="flex items-center gap-4">
                  {assignmentSubmissions.length > 0 && (
                    <button 
                      onClick={handleClearAllSubmissions}
                      disabled={isProcessing}
                      className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Submissions
                    </button>
                  )}
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Complete</span>
                    <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> Missed</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 uppercase tracking-widest text-[10px] font-black text-gray-400">
                    <tr>
                      <th className="px-8 py-4">Staident</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Time</th>
                      <th className="px-8 py-4">Sim Insights</th>
                      <th className="px-8 py-4 text-right">Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assignmentSubmissions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                              {s.studentName?.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-900">{s.studentName}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          {s.status === 'submitted' ? (
                            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Submitted</span>
                          ) : (
                            <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Missed</span>
                          )}
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2 text-gray-500 text-xs">
                            <Clock className="w-3 h-3" />
                            {s.submittedAt?.toDate ? new Date(s.submittedAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Simulating...'}
                          </div>
                        </td>
                        <td className="px-8 py-4 max-w-xs">
                          <p className="text-xs text-gray-600 line-clamp-1">{s.simulationExplanation || 'Work habits consistent with student profile.'}</p>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <button className="text-[#004275] font-black text-[10px] uppercase tracking-widest hover:underline">View Work</button>
                        </td>
                      </tr>
                    ))}
                    {assignmentSubmissions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-gray-500 italic">
                          No simulated submissions for this assignment yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'messages' && (
          <motion.div 
            key="messages"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Sidebar: Staident List */}
            <div className="md:col-span-1 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 px-2">Conversations</h3>
              <div className="space-y-2">
                {staidents.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => setSelectedStaident(s)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      selectedStaident?.id === s.id 
                        ? 'bg-[#004275]/5 border border-[#004275]/10 shadow-sm' 
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-[#004275]/20 flex items-center justify-center text-[#004275] font-black">
                      {s.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{s.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.skillLevel} Level</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="md:col-span-2 min-h-[500px] flex flex-col bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
              {selectedStaident ? (
                <>
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#004275] flex items-center justify-center text-white font-black">
                        {selectedStaident.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{selectedStaident.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Online / Simulated</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedStaident(null)}
                      className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[400px]">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <MessageCircle className="w-12 h-12 text-gray-200 mb-4" />
                        <p className="text-gray-400 text-sm font-medium">No messages yet with {selectedStaident.name}.<br/>Start a conversation to see AI student adaptation.</p>
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className={`flex ${m.isFromStaident ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium ${
                            m.isFromStaident 
                              ? 'bg-gray-100 text-gray-800 rounded-tl-none' 
                              : 'bg-[#004275] text-white rounded-tr-none shadow-md shadow-[#004275]/10'
                          }`}>
                            {m.text}
                          </div>
                        </div>
                      ))
                    )}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                    <input 
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`Message ${selectedStaident.name}...`}
                      className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={!newMessage.trim() || isTyping}
                      className="bg-[#004275] text-white p-3 rounded-2xl hover:bg-[#005a9c] transition-all shadow-lg shadow-[#004275]/20 disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                    <MessageCircle className="w-10 h-10 text-gray-200" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Select a Staident</h3>
                  <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">
                    Choose one of your AI students to test communication and guidance strategies.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color }: { title: string, value: string, subtitle: string, icon: React.ReactNode, color: 'blue' | 'green' | 'red' | 'purple' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100'
  };

  return (
    <div className={`p-6 rounded-[32px] border ${colors[color]} space-y-4 shadow-sm`}>
      <div className="flex justify-between items-start">
        <div className="p-2 bg-white rounded-xl shadow-sm border border-inherit">
          {icon}
        </div>
        <span className="text-xs font-black uppercase tracking-widest opacity-60">{title}</span>
      </div>
      <div>
        <h4 className="text-2xl font-black">{value}</h4>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{subtitle}</p>
      </div>
    </div>
  );
}
