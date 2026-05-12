import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Image as ImageIcon, 
  MousePointer2, 
  Type, 
  CheckSquare, 
  List, 
  ArrowLeft,
  X,
  Target,
  CheckCircle2,
  FileText,
  Upload,
  Info,
  GripVertical
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { QuizQuestion, Material } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface QuizCreatorProps {
  courseId: string;
  quizId?: string; // If editing existing
  onClose: () => void;
  onSaved: (quiz: any) => void;
}

export function QuizCreator({ courseId, quizId, onClose, onSaved }: QuizCreatorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Partial<QuizQuestion>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    } else {
      // Add a default first question
      addQuestion('multiple-choice');
    }
  }, [quizId]);

  const loadQuiz = async () => {
    setLoading(true);
    try {
      const quizDoc = await getDoc(doc(db, 'materials', quizId!));
      if (quizDoc.exists()) {
        const data = quizDoc.data();
        setTitle(data.title);
        setDescription(data.description || '');
        
        // Load questions
        const q = query(collection(db, 'quiz_questions'), where('quizId', '==', quizId), orderBy('order', 'asc'));
        const snap = await getDocs(q);
        setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizQuestion)));
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = (type: QuizQuestion['type']) => {
    const newQuestion: Partial<QuizQuestion> = {
      type,
      question: '',
      order: questions.length,
      options: type === 'multiple-choice' || type === 'checkbox' ? ['', '', '', ''] : (type === 'true-false' ? ['True', 'False'] : []),
      correctAnswer: type === 'true-false' ? 'True' : '',
      correctAnswers: [],
      hotspots: [],
      imageUrl: type === 'image-hotspot' ? 'https://picsum.photos/seed/worksheet/800/600' : '',
      dropdownOptions: type === 'dropdown' ? ['', ''] : [],
      blankCorrectAnswers: type === 'fill-in-the-blank' ? [''] : [],
      keywords: type === 'short-answer' ? [''] : [],
      points: 10
    };
    setQuestions([...questions, newQuestion]);
    setSelectedQuestionIndex(questions.length);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
    if (selectedQuestionIndex === index) {
      setSelectedQuestionIndex(null);
    } else if (selectedQuestionIndex !== null && selectedQuestionIndex > index) {
      setSelectedQuestionIndex(selectedQuestionIndex - 1);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Please enter a quiz title.");
      return;
    }

    if (!auth.currentUser) {
      alert("Please sign in to save.");
      return;
    }

    setSaving(true);
    try {
      let finalQuizId = quizId;
      
      const quizData = {
        title,
        description,
        courseId,
        type: 'quiz',
        points: questions.length * 10, // Example scoring
        timestamp: serverTimestamp(),
        published: true,
        uid: auth.currentUser.uid
      };

      if (!finalQuizId) {
        const docRef = await addDoc(collection(db, 'materials'), {
          ...quizData,
          parentId: null,
          published: true,
        });
        finalQuizId = docRef.id;
      } else {
        await updateDoc(doc(db, 'materials', finalQuizId), quizData);
      }

      // Save questions
      const batch = writeBatch(db);
      
      // Delete existing questions if editing
      if (quizId) {
        const existingQs = await getDocs(query(collection(db, 'quiz_questions'), where('quizId', '==', quizId)));
        existingQs.forEach(d => batch.delete(d.ref));
      }

      questions.forEach((q, idx) => {
        const qRef = doc(collection(db, 'quiz_questions'));
        batch.set(qRef, {
          ...q,
          quizId: finalQuizId,
          order: idx,
          timestamp: serverTimestamp()
        });
      });

      await batch.commit();
      onSaved({ id: finalQuizId, ...quizData });
      onClose();
    } catch (error) {
      console.error("Error saving quiz:", error);
      alert("Failed to save quiz. See console for details.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 animate-spin text-[#004275]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#f9f9f9] z-[150] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Quiz"
              className="text-2xl font-black text-[#004275] focus:outline-none placeholder-gray-300 font-headline bg-transparent"
            />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Quiz Creator</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-2 bg-[#004275] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#005a9c] transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {quizId ? 'Update Quiz' : 'Save Quiz'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Question List */}
        <aside className="w-80 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Questions</h3>
            <div className="grid grid-cols-2 gap-2">
              <AddQuestionBtn label="Choice" icon={CheckSquare} onClick={() => addQuestion('multiple-choice')} />
              <AddQuestionBtn label="Checkmarks" icon={CheckSquare} onClick={() => addQuestion('checkbox')} />
              <AddQuestionBtn label="Hotspot" icon={Target} onClick={() => addQuestion('image-hotspot')} />
              <AddQuestionBtn label="True/False" icon={CheckCircle2} onClick={() => addQuestion('true-false')} />
              <AddQuestionBtn label="Short" icon={Type} onClick={() => addQuestion('short-answer')} />
              <AddQuestionBtn label="Essay" icon={FileText} onClick={() => addQuestion('essay')} />
              <AddQuestionBtn label="Blank" icon={Type} onClick={() => addQuestion('fill-in-the-blank')} />
              <AddQuestionBtn label="Match" icon={List} onClick={() => addQuestion('matching')} />
              <AddQuestionBtn label="Dropdown" icon={List} onClick={() => addQuestion('dropdown')} />
              <AddQuestionBtn label="Upload" icon={Upload} onClick={() => addQuestion('file-upload')} />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedQuestionIndex(idx)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                  selectedQuestionIndex === idx 
                    ? 'border-[#004275] bg-[#004275]/5 shadow-sm' 
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                  selectedQuestionIndex === idx ? 'bg-[#004275] text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {q.question || 'Untitled Question'}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {q.type?.replace('-', ' ')}
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#f9f9f9]">
          <div className="max-w-4xl mx-auto">
            {selectedQuestionIndex !== null ? (
              <motion.div
                key={selectedQuestionIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-10"
              >
                <div className="space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-4 flex-1">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400">Question Text</label>
                      <textarea
                        value={questions[selectedQuestionIndex].question}
                        onChange={(e) => updateQuestion(selectedQuestionIndex, { question: e.target.value })}
                        className="w-full text-3xl font-black text-gray-900 placeholder-gray-200 focus:outline-none bg-transparent resize-none h-auto font-headline"
                        placeholder="What is your question?"
                        rows={2}
                      />
                    </div>
                  </div>

                  {questions[selectedQuestionIndex].type === 'multiple-choice' && (
                    <ChoiceEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}

                  {questions[selectedQuestionIndex].type === 'checkbox' && (
                    <CheckboxEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}

                  {questions[selectedQuestionIndex].type === 'image-hotspot' && (
                    <HotspotEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}
                  
                  {questions[selectedQuestionIndex].type === 'matching' && (
                    <MatchingEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}

                  {questions[selectedQuestionIndex].type === 'true-false' && (
                    <TrueFalseEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}

                  {questions[selectedQuestionIndex].type === 'dropdown' && (
                    <DropdownEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}

                  {questions[selectedQuestionIndex].type === 'fill-in-the-blank' && (
                    <FillInBlankEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}

                  {questions[selectedQuestionIndex].type === 'short-answer' && (
                    <ShortAnswerEditor 
                      question={questions[selectedQuestionIndex]} 
                      onUpdate={(updates) => updateQuestion(selectedQuestionIndex, updates)} 
                    />
                  )}

                  {questions[selectedQuestionIndex].type === 'essay' && (
                    <div className="p-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h4 className="font-bold text-gray-900">Essay Question</h4>
                      <p className="text-gray-400 text-sm mt-2">Students will provide a long-form text response. Manual grading is required.</p>
                    </div>
                  )}

                  {questions[selectedQuestionIndex].type === 'file-upload' && (
                    <div className="p-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                      <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h4 className="font-bold text-gray-900">File Upload Question</h4>
                      <p className="text-gray-400 text-sm mt-2">Students will need to upload a file (PDF, Doc, Image) as their response.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 mb-6">
                  <MousePointer2 className="w-10 h-10 text-[#004275]" />
                </div>
                <h3 className="text-2xl font-black text-[#004275] mb-2 font-headline">No Question Selected</h3>
                <p className="text-gray-400 max-w-sm px-8">Select a question from the sidebar or add a new one to begin editing.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AddQuestionBtn({ label, icon: Icon, onClick }: { label: string, icon: any, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 bg-white border border-gray-100 rounded-xl hover:border-[#004275] hover:bg-[#004275]/5 transition-all text-gray-600 hover:text-[#004275] shadow-sm"
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function ChoiceEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  const addOption = () => {
    onUpdate({ options: [...(question.options || []), ''] });
  };

  const removeOption = (idx: number) => {
    onUpdate({ options: (question.options || []).filter((_, i) => i !== idx) });
  };

  const updateOption = (idx: number, text: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[idx] = text;
    onUpdate({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 block">Answer Options (Select One Correct)</label>
      <div className="space-y-2">
        {question.options?.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onUpdate({ correctAnswer: opt })}
              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                question.correctAnswer === opt ? 'border-green-500 bg-green-500' : 'border-gray-200'
              }`}
            >
              {question.correctAnswer === opt && <Plus className="w-5 h-5 text-white" />}
            </button>
            <input 
              type="text"
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all font-bold"
            />
            <button onClick={() => removeOption(idx)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      <button 
        onClick={addOption}
        className="flex items-center gap-2 text-[#004275] font-bold text-sm hover:underline p-2"
      >
        <Plus className="w-4 h-4" />
        Add Option
      </button>
    </div>
  );
}

function CheckboxEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  const addOption = () => {
    onUpdate({ options: [...(question.options || []), ''] });
  };

  const removeOption = (idx: number) => {
    onUpdate({ options: (question.options || []).filter((_, i) => i !== idx) });
  };

  const updateOption = (idx: number, text: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[idx] = text;
    onUpdate({ options: newOptions });
  };

  const toggleAnswer = (opt: string) => {
    const current = question.correctAnswers || [];
    if (current.includes(opt)) {
      onUpdate({ correctAnswers: current.filter(a => a !== opt) });
    } else {
      onUpdate({ correctAnswers: [...current, opt] });
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 block">Answer Options (Select All Correct)</label>
      <div className="space-y-2">
        {question.options?.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleAnswer(opt)}
              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                question.correctAnswers?.includes(opt) ? 'border-green-500 bg-green-500' : 'border-gray-200'
              }`}
            >
              {question.correctAnswers?.includes(opt) && <CheckSquare className="w-5 h-5 text-white" />}
            </button>
            <input 
              type="text"
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all font-bold"
            />
            <button onClick={() => removeOption(idx)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      <button 
        onClick={addOption}
        className="flex items-center gap-2 text-[#004275] font-bold text-sm hover:underline p-2"
      >
        <Plus className="w-4 h-4" />
        Add Option
      </button>
    </div>
  );
}

function MatchingEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  const pairs = question.matchingPairs || {};
  
  const addPair = () => {
    onUpdate({ matchingPairs: { ...pairs, '': '' } });
  };

  const updateKey = (oldKey: string, newKey: string) => {
    const newPairs = { ...pairs };
    const val = newPairs[oldKey];
    delete newPairs[oldKey];
    newPairs[newKey] = val;
    onUpdate({ matchingPairs: newPairs });
  };

  const updateValue = (key: string, newVal: string) => {
    onUpdate({ matchingPairs: { ...pairs, [key]: newVal } });
  };

  return (
    <div className="space-y-4">
      <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 block">Matching Pairs</label>
      <div className="space-y-3">
        {Object.entries(pairs).map(([key, val], idx) => (
          <div key={idx} className="flex gap-4 items-center">
            <input 
              type="text"
              value={key}
              onChange={(e) => updateKey(key, e.target.value)}
              placeholder="Item A"
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm"
            />
            <Plus className="w-4 h-4 text-gray-200" />
            <input 
              type="text"
              value={val}
              onChange={(e) => updateValue(key, e.target.value)}
              placeholder="Matches B"
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm"
            />
          </div>
        ))}
      </div>
      <button onClick={addPair} className="text-[#004275] font-bold text-sm flex items-center gap-2 hover:underline">
        <Plus className="w-4 h-4" /> Add Match Pair
      </button>
    </div>
  );
}

function HotspotEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const addHotspot = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newHotspot = {
      x,
      y,
      width: 10,
      height: 10,
      isCorrect: true,
      label: `Hotspot ${ (question.hotspots?.length || 0) + 1 }`
    };

    onUpdate({ hotspots: [...(question.hotspots || []), newHotspot] });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Background Image URL</label>
        <div className="flex gap-2">
          <input 
            type="text"
            value={question.imageUrl}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
            className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all"
            placeholder="Paste worksheet/image URL..."
          />
          <button className="p-3 bg-[#004275] text-white rounded-xl shadow-lg">
            <ImageIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative rounded-[32px] overflow-hidden border-4 border-white shadow-xl bg-gray-800 aspect-video group">
        <img 
          src={question.imageUrl} 
          className="w-full h-full object-contain"
          onMouseDown={(e) => e.preventDefault()}
        />
        <div 
          className="absolute inset-0 cursor-crosshair"
          onClick={addHotspot}
        >
          {question.hotspots?.map((h, idx) => (
            <div 
              key={idx}
              className={`absolute border-2 border-dashed shadow-2xl transition-all ${
                h.isCorrect ? 'border-green-500 bg-green-500/20' : 'border-red-500 bg-red-500/20'
              }`}
              style={{ 
                left: `${h.x}%`, 
                top: `${h.y}%`, 
                width: `${h.width}%`, 
                height: `${h.height}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded text-[10px] font-black uppercase shadow-sm whitespace-nowrap">
                {h.label}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ hotspots: question.hotspots?.filter((_, i) => i !== idx) });
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-6 py-3 rounded-full text-white text-xs font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
          Click anywhere on the image to place an answer hotspot
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Hotspots Config</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.hotspots?.map((h, idx) => (
            <div key={idx} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                 <input 
                  value={h.label} 
                  onChange={(e) => {
                    const newHotspots = [...(question.hotspots || [])];
                    newHotspots[idx].label = e.target.value;
                    onUpdate({ hotspots: newHotspots });
                  }}
                  className="font-bold text-sm bg-transparent border-none focus:outline-none"
                 />
                 <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const newHotspots = [...(question.hotspots || [])];
                        newHotspots[idx].isCorrect = !newHotspots[idx].isCorrect;
                        onUpdate({ hotspots: newHotspots });
                      }}
                      className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                        h.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {h.isCorrect ? 'Correct' : 'Distractor'}
                    </button>
                 </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 block mb-1">Feedback Message</label>
                  <input 
                    value={h.feedback}
                    onChange={(e) => {
                      const newHotspots = [...(question.hotspots || [])];
                      newHotspots[idx].feedback = e.target.value;
                      onUpdate({ hotspots: newHotspots });
                    }}
                    placeholder="Nice job! or Try again..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShortAnswerEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  const addKeyword = () => {
    onUpdate({ keywords: [...(question.keywords || []), ''] });
  };

  const updateKeyword = (idx: number, val: string) => {
    const newKeywords = [...(question.keywords || [])];
    newKeywords[idx] = val;
    onUpdate({ keywords: newKeywords });
  };

  return (
    <div className="space-y-4">
      <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 block">Auto-Grading Keywords (Case-insensitive)</label>
      <div className="space-y-2">
        {question.keywords?.map((kw, idx) => (
          <div key={idx} className="flex gap-2">
            <input 
              type="text"
              value={kw}
              onChange={(e) => updateKeyword(idx, e.target.value)}
              placeholder="Enter a keyword that must be present..."
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all"
            />
            <button 
              onClick={() => onUpdate({ keywords: question.keywords?.filter((_, i) => i !== idx) })}
              className="p-3 text-gray-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addKeyword} className="text-[#004275] font-bold text-sm flex items-center gap-2 hover:underline">
        <Plus className="w-4 h-4" /> Add Required Keyword
      </button>
    </div>
  );
}

function TrueFalseEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  return (
    <div className="space-y-4">
      <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 block">Correct Answer</label>
      <div className="flex gap-4">
        {['True', 'False'].map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => onUpdate({ correctAnswer: val })}
            className={`flex-1 p-6 rounded-3xl border-2 font-black transition-all ${
              question.correctAnswer === val 
                ? 'border-[#004275] bg-[#004275] text-white shadow-lg scale-105' 
                : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}

function DropdownEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  const addOption = () => {
    onUpdate({ dropdownOptions: [...(question.dropdownOptions || []), ''] });
  };

  const updateOption = (idx: number, val: string) => {
    const newOptions = [...(question.dropdownOptions || [])];
    newOptions[idx] = val;
    onUpdate({ dropdownOptions: newOptions });
  };

  return (
    <div className="space-y-4">
      <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 block">Dropdown Selection Options</label>
      <div className="space-y-2">
        {question.dropdownOptions?.map((opt, idx) => (
          <div key={idx} className="flex gap-2">
            <input 
              type="text"
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all"
            />
            <button 
              onClick={() => onUpdate({ correctAnswer: opt })}
              className={`p-3 rounded-xl transition-all ${
                question.correctAnswer === opt ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onUpdate({ dropdownOptions: question.dropdownOptions?.filter((_, i) => i !== idx) })}
              className="p-3 text-gray-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addOption} className="text-[#004275] font-bold text-sm flex items-center gap-2 hover:underline">
        <Plus className="w-4 h-4" /> Add Dropdown Option
      </button>
    </div>
  );
}

function FillInBlankEditor({ question, onUpdate }: { question: Partial<QuizQuestion>, onUpdate: (updates: Partial<QuizQuestion>) => void }) {
  const addBlank = () => {
    onUpdate({ blankCorrectAnswers: [...(question.blankCorrectAnswers || []), ''] });
  };

  const updateBlank = (idx: number, val: string) => {
    const newBlanks = [...(question.blankCorrectAnswers || [])];
    newBlanks[idx] = val;
    onUpdate({ blankCorrectAnswers: newBlanks });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-6 rounded-3xl mb-6">
        <p className="text-xs text-blue-700 leading-relaxed font-medium">
          <Info className="w-4 h-4 inline mr-1 mb-0.5" />
          Instructions: Use underscores <b>____</b> in the question text above to indicate where blanks should appear. 
          Then list the correct answers for each blank here in order.
        </p>
      </div>
      <label className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 block">Correct Answers (In Order)</label>
      <div className="space-y-2">
        {question.blankCorrectAnswers?.map((ans, idx) => (
          <div key={idx} className="flex gap-2">
            <div className="w-10 h-10 bg-[#004275] text-white flex items-center justify-center rounded-xl font-black text-xs">
              {idx + 1}
            </div>
            <input 
              type="text"
              value={ans}
              onChange={(e) => updateBlank(idx, e.target.value)}
              placeholder={`Answer for blank ${idx + 1}`}
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#004275]/10 outline-none transition-all"
            />
            <button 
              onClick={() => onUpdate({ blankCorrectAnswers: question.blankCorrectAnswers?.filter((_, i) => i !== idx) })}
              className="p-3 text-gray-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addBlank} className="text-[#004275] font-bold text-sm flex items-center gap-2 hover:underline">
        <Plus className="w-4 h-4" /> Add Blank Answer
      </button>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
