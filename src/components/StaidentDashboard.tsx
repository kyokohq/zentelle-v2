import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Staident, Material, Submission } from '../types';
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
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StaidentDashboardProps {
  courseId: string;
  staidents: Staident[];
}

export function StaidentDashboard({ courseId, staidents }: StaidentDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'manage' | 'simulate' | 'analytics'>('manage');
  const [assignments, setAssignments] = useState<Material[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [simulationDelay, setSimulationDelay] = useState(10); // Default 10 seconds
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    // Fetch assignments
    const fetchAssignments = async () => {
      const q = query(
        collection(db, 'materials'), 
        where('courseId', '==', courseId),
        where('type', '==', 'assignment')
      );
      const snap = await getDocs(q);
      setAssignments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    };
    fetchAssignments();

    // Listen for simulated submissions
    const qSub = query(
      collection(db, 'submissions'),
      where('isSimulated', '==', true)
    );
    const unsub = onSnapshot(qSub, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });

    return () => unsub();
  }, [courseId]);

  const handleAddStaidents = async () => {
    await StaidentService.addStaidentsToCourse(courseId, 3);
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
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                Active Staidents ({staidents.length})
              </h3>
              <button 
                onClick={handleAddStaidents}
                className="bg-[#004275] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#005a9c] transition-all"
              >
                <Plus className="w-4 h-4" /> Add AI Students
              </button>
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
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Submission Log</h3>
                <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                  <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Complete</span>
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> Missed</span>
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
