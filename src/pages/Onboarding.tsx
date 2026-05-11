import React, { useState } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, School } from '../types';
import { 
  Building, 
  Plus, 
  ArrowRight, 
  Shield, 
  GraduationCap, 
  Palette,
  CheckCircle2,
  Globe,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingProps {
  userProfile: UserProfile;
  onComplete: (schoolId: string) => void;
}

export function Onboarding({ userProfile, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'create' | 'join'>('welcome');
  const [loading, setLoading] = useState(false);

  const handleCreateSchool = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const schoolData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      domain: formData.get('domain') as string || '',
      color: formData.get('color') as string || '#004275',
      logoUrl: '',
      uid: userProfile.uid,
      timestamp: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'schools'), schoolData);
      
      // Update user profile to be admin of this school
      await setDoc(doc(db, 'users', userProfile.uid), {
        ...userProfile,
        schoolId: docRef.id,
        role: 'admin'
      });
      
      onComplete(docRef.id);
    } catch (error) {
      console.error("Error creating school:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="bg-white rounded-[40px] shadow-2xl overflow-hidden grid md:grid-cols-2"
            >
              <div className="p-12 flex flex-col justify-center">
                <div className="w-16 h-16 bg-[#004275] rounded-3xl flex items-center justify-center mb-8 shadow-xl">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-black text-[#004275] font-headline mb-4 leading-tight">
                  Welcome to Zentelle.
                </h1>
                <p className="text-gray-500 mb-12 text-lg">
                  Every account needs to be associated with a school. How would you like to proceed?
                </p>
                
                <div className="space-y-4">
                  <button 
                    onClick={() => setStep('create')}
                    className="w-full flex items-center justify-between p-6 bg-gray-50 border border-gray-100 rounded-3xl hover:bg-gray-100 hover:border-gray-200 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#004275]/10 rounded-2xl text-[#004275]">
                        <Plus className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black text-[#004275] uppercase tracking-widest text-xs">Option A</span>
                        <span className="block font-bold text-gray-900 text-lg">Create a New School</span>
                      </div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-[#004275] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </button>

                  <button 
                    onClick={() => setStep('join')}
                    className="w-full flex items-center justify-between p-6 bg-gray-50 border border-gray-100 rounded-3xl hover:bg-gray-100 hover:border-gray-200 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black text-blue-500 uppercase tracking-widest text-xs">Option B</span>
                        <span className="block font-bold text-gray-900 text-lg">Connect to a School</span>
                      </div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-blue-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  </button>
                </div>
              </div>
              <div className="bg-[#004275] p-12 text-white flex flex-col justify-center hidden md:flex">
                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl mb-1">Administrative Privileges</h3>
                      <p className="text-blue-100/70">Creating a school automatically makes you a school administrator.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                      <Palette className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl mb-1">Complete Customization</h3>
                      <p className="text-blue-100/70">Set your school's brand colors, logos, and academic programs.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl mb-1">User Management</h3>
                      <p className="text-blue-100/70">Manage students, teachers, and staff accounts in one place.</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[40px] shadow-2xl p-12 max-w-2xl mx-auto"
            >
              <button 
                onClick={() => setStep('welcome')}
                className="mb-8 text-[#004275] font-bold flex items-center gap-2 hover:underline"
              >
                <ArrowRight className="w-4 h-4 rotate-180" /> Back
              </button>

              <h2 className="text-3xl font-black text-[#004275] font-headline mb-8">Setup Your School</h2>
              
              <form onSubmit={handleCreateSchool} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Official School Name</label>
                  <input 
                    name="name"
                    required
                    placeholder="e.g. Riverside International Academy"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-[#004275]/10 font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Domain (Optional)</label>
                  <div className="relative">
                    <Globe className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      name="domain"
                      placeholder="riverside.edu"
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-14 pr-6 py-4 outline-none focus:ring-2 focus:ring-[#004275]/10 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Brand Color</label>
                    <input 
                      name="color"
                      type="color"
                      defaultValue="#004275"
                      className="w-full h-14 bg-gray-50 border border-gray-200 rounded-2xl px-2 py-2 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400">Academic Level</label>
                    <select className="w-full h-14 bg-gray-50 border border-gray-200 rounded-2xl px-6 outline-none font-bold">
                      <option>High School</option>
                      <option>University</option>
                      <option>Primary School</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400">Description</label>
                  <textarea 
                    name="description"
                    placeholder="A brief mission statement..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-[#004275]/10 font-bold h-32"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#004275] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#005a9c] transition-all shadow-xl shadow-[#004275]/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? 'Registering School...' : 'Launch School Panel'}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'join' && (
            <motion.div 
              key="join"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[40px] shadow-2xl p-12 max-w-2xl mx-auto text-center"
            >
              <button 
                onClick={() => setStep('welcome')}
                className="mb-8 text-blue-500 font-bold flex items-center gap-2 hover:underline"
              >
                <ArrowRight className="w-4 h-4 rotate-180" /> Back
              </button>

              <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <GraduationCap className="w-10 h-10 text-blue-500" />
              </div>
              
              <h2 className="text-3xl font-black text-gray-900 font-headline mb-4">Under Construction</h2>
              <p className="text-gray-500 text-lg mb-8">
                School-joining discovery and invitations will be available in the next update. For now, please create a new school to explore the features.
              </p>

              <button 
                onClick={() => setStep('create')}
                className="bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20"
              >
                Create a School Instead
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
