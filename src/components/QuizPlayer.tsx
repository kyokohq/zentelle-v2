import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  Trophy,
  AlertCircle,
  RotateCcw,
  MousePointer2,
  Send,
  Upload,
  Loader2,
  CheckSquare
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { QuizQuestion, Material, QuizSubmission } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface QuizPlayerProps {
  quizId: string;
  onClose: () => void;
}

export function QuizPlayer({ quizId, onClose }: QuizPlayerProps) {
  const [quiz, setQuiz] = useState<Material | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quiz?.dueDate && !completed) {
      // Basic timer logic if we had a time limit
      // const timer = setInterval(() => setTimeLeft(prev => prev! - 1), 1000);
      // return () => clearInterval(timer);
    }
  }, [quiz, completed]);

  const loadQuiz = async () => {
    try {
      const quizDoc = await getDoc(doc(db, 'materials', quizId));
      if (quizDoc.exists()) {
        setQuiz({ id: quizDoc.id, ...quizDoc.data() } as Material);
      }

      const q = query(
        collection(db, 'quiz_questions'), 
        where('quizId', '==', quizId),
        orderBy('order', 'asc')
      );
      const snap = await getDocs(q);
      setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizQuestion)));
    } catch (error) {
      console.error("Error loading quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  const handleAnswerChange = (answer: any) => {
    setAnswers({ ...answers, [currentQuestion.id]: answer });
  };

  const handleHotspotClick = (hotspot: any) => {
    if (completed) return;
    handleAnswerChange(hotspot.label);
    setShowFeedback(hotspot.feedback || (hotspot.isCorrect ? "Great work!" : "Incorrect area selected."));
    setIsCorrect(hotspot.isCorrect);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowFeedback(null);
      setIsCorrect(null);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setSubmitting(true);
    try {
      // Calculate score
      let correctCount = 0;
      questions.forEach(q => {
        const studentAnswer = answers[q.id];
        if (q.type === 'image-hotspot') {
          const hotspot = q.hotspots?.find(h => h.label === studentAnswer);
          if (hotspot?.isCorrect) correctCount++;
        } else if (q.type === 'checkbox') {
          const studentAnswers = studentAnswer as string[] || [];
          const correctAnswers = q.correctAnswers || [];
          const isCorrect = studentAnswers.length === correctAnswers.length && 
                           studentAnswers.every(a => correctAnswers.includes(a));
          if (isCorrect) correctCount++;
        } else if (q.type === 'matching') {
          const studentMatches = studentAnswer as Record<string, string> || {};
          const correctPairs = q.matchingPairs || {};
          const totalPairs = Object.keys(correctPairs).length;
          if (totalPairs === 0) {
              correctCount++; 
          } else {
              let pairCorrect = 0;
              Object.entries(correctPairs).forEach(([k, v]) => {
                if (studentMatches[k] === v) pairCorrect++;
              });
              if (pairCorrect === totalPairs) correctCount++;
          }
        } else if (q.type === 'fill-in-the-blank') {
          const studentAnswers = studentAnswer as string[] || [];
          const correctAnswers = q.blankCorrectAnswers || [];
          const isCorrect = correctAnswers.length > 0 && correctAnswers.every((ans, i) => 
            studentAnswers[i]?.toLowerCase().trim() === ans.toLowerCase().trim()
          );
          if (isCorrect) correctCount++;
        } else if (q.type === 'short-answer') {
          const keywords = q.keywords || [];
          const answer = (studentAnswer as string || '').toLowerCase();
          const hasAllKeywords = keywords.length > 0 && keywords.every(kw => 
            answer.includes(kw.toLowerCase().trim())
          );
          // If no keywords defined, treat as manual grading (not auto-correct)
          if (keywords.length > 0 && hasAllKeywords) correctCount++;
        } else if (q.type === 'multiple-choice' || q.type === 'true-false' || q.type === 'dropdown') {
          if (studentAnswer?.toLowerCase().trim() === q.correctAnswer?.toLowerCase().trim()) {
            correctCount++;
          }
        }
        // Essay and File Upload are skipped for auto-grading (count as 0 for now)
      });

      const finalScore = Math.round((correctCount / questions.length) * 100);

      const submissionData: Partial<QuizSubmission> = {
        quizId,
        uid: auth.currentUser.uid,
        answers,
        score: finalScore,
        status: 'submitted',
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'quiz_submissions'), submissionData);
      
      // Update global submission for gradebook integration
      await addDoc(collection(db, 'submissions'), {
        materialId: quizId,
        uid: auth.currentUser.uid,
        studentName: auth.currentUser.displayName,
        grade: finalScore,
        status: 'submitted',
        timestamp: serverTimestamp(),
        submittedAt: serverTimestamp()
      });

      setScore(finalScore);
      setCompleted(true);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Failed to submit. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]">
        <Loader2 className="w-10 h-10 animate-spin text-[#004275]" />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="fixed inset-0 bg-[#f9f9f9] z-[200] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[40px] shadow-2xl p-12 max-w-lg w-full text-center"
        >
          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Trophy className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-4xl font-black text-[#004275] mb-2 font-headline">Quiz Completed!</h2>
          <p className="text-gray-500 font-medium mb-8">You've successfully finished the assessment.</p>
          
          <div className="bg-gray-50 rounded-3xl p-8 mb-8">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Final Score</p>
            <p className={`text-6xl font-black font-headline ${score! >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
              {score}%
            </p>
          </div>

          <button 
            onClick={onClose}
            className="w-full bg-[#004275] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#005a9c] transition-all shadow-lg active:scale-95"
          >
            Return to Materials
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#f9f9f9] z-[200] flex flex-col">
      {/* HUD Header */}
      <header className="bg-white border-b border-gray-100 p-6 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#004275] font-headline">{quiz?.title}</h1>
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#004275] transition-all duration-500" 
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-[#004275]/5 px-4 py-2 rounded-xl text-[#004275]">
            <Clock className="w-4 h-4" />
            <span className="font-bold text-sm">--:--</span>
          </div>
        </div>
      </header>

      {/* Main Player Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-12">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 md:p-12 mb-8 flex-1 flex flex-col">
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-10 font-headline leading-tight">
                  {currentQuestion?.question}
                </h2>

                <div className="flex-1">
                  {currentQuestion?.type === 'multiple-choice' && (
                    <div className="grid grid-cols-1 gap-4">
                      {currentQuestion.options?.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleAnswerChange(opt)}
                          className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                            answers[currentQuestion.id] === opt 
                              ? 'border-[#004275] bg-[#004275]/5 shadow-md' 
                              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`text-lg font-bold ${answers[currentQuestion.id] === opt ? 'text-[#004275]' : 'text-gray-700'}`}>
                            {opt}
                          </span>
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                            answers[currentQuestion.id] === opt ? 'border-[#004275] bg-[#004275] text-white' : 'border-gray-200'
                          }`}>
                            {answers[currentQuestion.id] === opt && <CheckCircle2 className="w-5 h-5" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentQuestion?.type === 'checkbox' && (
                    <div className="grid grid-cols-1 gap-4">
                      {currentQuestion.options?.map((opt, i) => {
                        const isSelected = (answers[currentQuestion.id] || []).includes(opt);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              const current = answers[currentQuestion.id] || [];
                              const newAnswers = isSelected 
                                ? current.filter((a: string) => a !== opt)
                                : [...current, opt];
                              handleAnswerChange(newAnswers);
                            }}
                            className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                              isSelected 
                                ? 'border-[#004275] bg-[#004275]/5 shadow-md' 
                                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span className={`text-lg font-bold ${isSelected ? 'text-[#004275]' : 'text-gray-700'}`}>
                              {opt}
                            </span>
                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-[#004275] bg-[#004275] text-white' : 'border-gray-200'
                            }`}>
                              {isSelected && <CheckSquare className="w-5 h-5" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion?.type === 'matching' && (
                    <MatchingPlayer 
                      question={currentQuestion} 
                      answer={answers[currentQuestion.id]} 
                      onChange={handleAnswerChange} 
                    />
                  )}

                  {currentQuestion?.type === 'short-answer' && (
                    <textarea 
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl p-8 text-xl focus:ring-4 focus:ring-[#004275]/10 outline-none transition-all resize-none h-64"
                    />
                  )}

          {currentQuestion?.type === 'image-hotspot' && (
            <div className="relative rounded-[40px] overflow-hidden bg-gray-900 aspect-video group shadow-2xl border-4 border-white">
              <img 
                src={currentQuestion.imageUrl} 
                className="w-full h-full object-contain pointer-events-none"
              />
              <div className="absolute inset-0 cursor-crosshair">
                {currentQuestion.hotspots?.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => handleHotspotClick(h)}
                    className={`absolute border-2 border-dashed transition-all active:scale-95 ${
                      answers[currentQuestion.id] === h.label ? 'border-white bg-white/20 scale-110' : 'border-transparent group-hover:border-white/10'
                    }`}
                    style={{ 
                      left: `${h.x}%`, 
                      top: `${h.y}%`, 
                      width: `${h.width}%`, 
                      height: `${h.height}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <MousePointer2 className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  </button>
                ))}
              </div>
              
              {!answers[currentQuestion.id] && (
                <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Click the correct area on the image
                    </div>
                </div>
              )}
            </div>
          )}

          {currentQuestion?.type === 'true-false' && (
            <div className="flex flex-col gap-6 max-w-md mx-auto">
              {['True', 'False'].map((val) => (
                <button
                  key={val}
                  onClick={() => handleAnswerChange(val)}
                  className={`w-full p-8 rounded-3xl border-4 text-2xl font-black transition-all ${
                    answers[currentQuestion.id] === val 
                      ? 'border-[#004275] bg-[#004275] text-white shadow-xl scale-105' 
                      : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          )}

          {currentQuestion?.type === 'dropdown' && (
            <div className="max-w-md mx-auto">
              <select
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="w-full p-8 rounded-[32px] border-4 border-gray-100 bg-white text-2xl font-black text-[#004275] outline-none focus:border-[#004275] transition-all"
              >
                <option value="">Select an answer...</option>
                {currentQuestion.dropdownOptions?.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          {currentQuestion?.type === 'fill-in-the-blank' && (
            <div className="space-y-6">
              <p className="text-gray-500 mb-8 font-medium">Fill in the blanks (indicated by underscores in the text above).</p>
              {(currentQuestion.blankCorrectAnswers || []).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#004275] text-white flex items-center justify-center rounded-2xl font-black">{i + 1}</div>
                  <input 
                    type="text"
                    value={(answers[currentQuestion.id] || [])[i] || ''}
                    onChange={(e) => {
                      const current = answers[currentQuestion.id] || [];
                      const next = [...current];
                      next[i] = e.target.value;
                      handleAnswerChange(next);
                    }}
                    placeholder={`Answer for blank ${i + 1}`}
                    className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-xl font-bold focus:border-[#004275] outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {currentQuestion?.type === 'essay' && (
            <textarea 
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your essay response here..."
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl p-8 text-xl focus:ring-4 focus:ring-[#004275]/10 outline-none transition-all resize-none h-96"
            />
          )}

          {currentQuestion?.type === 'file-upload' && (
            <div className="p-12 bg-gray-50 rounded-[40px] border-4 border-dashed border-gray-200 text-center group hover:bg-gray-100 transition-all cursor-pointer relative">
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAnswerChange(file.name);
                }}
              />
              <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-2xl font-black text-gray-900 mb-2">
                {answers[currentQuestion.id] || 'Upload File'}
              </h4>
              <p className="text-gray-400">Click or drag your response file here.</p>
            </div>
          )}
                </div>

                {/* Question Feedback Overlay */}
                <AnimatePresence>
                  {showFeedback && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-8 p-6 rounded-3xl flex items-center gap-4 ${
                        isCorrect ? 'bg-green-50 border border-green-100 text-green-800' : 'bg-red-50 border border-red-100 text-red-800'
                      }`}
                    >
                      {isCorrect ? <CheckCircle2 className="w-8 h-8" /> : <X className="w-8 h-8" />}
                      <div className="flex-1">
                        <p className="font-black uppercase tracking-widest text-[10px] mb-1">
                          {isCorrect ? 'Correct!' : 'Incorrect'}
                        </p>
                        <p className="text-sm font-bold">{showFeedback}</p>
                      </div>
                      <button 
                        onClick={handleNext}
                        className="bg-white/50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white transition-all shadow-sm"
                      >
                        Got it
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation Footer */}
              <div className="flex justify-between items-center px-4">
                <button 
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                  className="flex items-center gap-2 text-gray-400 hover:text-gray-800 font-bold disabled:opacity-0 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous
                </button>

                <div className="flex gap-2">
                  {questions.map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentIndex ? 'bg-[#004275] w-6' : 
                        answers[questions[i].id] ? 'bg-green-500' : 'bg-gray-200'
                      }`} 
                    />
                  ))}
                </div>

                <button 
                  onClick={handleNext}
                  disabled={!answers[currentQuestion?.id] || submitting}
                  className="flex items-center gap-2 bg-[#004275] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#005a9c] transition-all shadow-xl active:scale-95 disabled:grayscale disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    currentIndex === questions.length - 1 ? (
                      <>Submit Results <Send className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>Next Question <ChevronRight className="w-5 h-5" /></>
                    )
                  )}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function MatchingPlayer({ question, answer, onChange }: { question: QuizQuestion, answer: Record<string, string>, onChange: (val: Record<string, string>) => void }) {
  const pairs = question.matchingPairs || {};
  const leftItems = Object.keys(pairs);
  const rightItems = Array.from(new Set(Object.values(pairs))).sort(() => Math.random() - 0.5);
  const currentAnswers = answer || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       <div className="space-y-4">
         <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Items</h4>
         {leftItems.map((item, i) => (
           <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold text-gray-700">
             {item}
           </div>
         ))}
       </div>
       <div className="space-y-4">
         <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Match To</h4>
         {leftItems.map((item, i) => (
           <select
             key={i}
             value={currentAnswers[item] || ''}
             onChange={(e) => onChange({ ...currentAnswers, [item]: e.target.value })}
             className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-[#004275] outline-none focus:ring-2 focus:ring-[#004275] transition-all"
           >
             <option value="">Select a match...</option>
             {rightItems.map((opt, j) => (
               <option key={j} value={opt}>{opt}</option>
             ))}
           </select>
         ))}
       </div>
    </div>
  );
}
