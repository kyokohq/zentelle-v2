import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FileText, 
  ExternalLink, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Cloud, 
  Copy, 
  Eye, 
  Lock, 
  Unlock, 
  AlertCircle,
  Send,
  History,
  MessageSquare,
  MoreVertical,
  Download,
  Calendar,
  User,
  CheckCircle,
  Upload,
  Type as TypeIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Material, Submission } from '../types';

export default function AssignmentDetail({ userRole }: { userRole?: string }) {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Material | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const [textSubmission, setTextSubmission] = useState('');
  const [isTextMode, setIsTextMode] = useState(false);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    // Check Google Auth status
    const checkGoogleAuth = async () => {
      try {
        const res = await fetch('/api/auth/google/status');
        const data = await res.json();
        setIsGoogleAuth(data.isAuthenticated);
      } catch (error) {
        console.error("Error checking Google Auth status:", error);
      }
    };
    checkGoogleAuth();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsGoogleAuth(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (error) {
      console.error("Error getting Google Auth URL:", error);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await fetch('/api/auth/google/logout', { method: 'POST' });
      setIsGoogleAuth(false);
    } catch (error) {
      console.error("Error logging out from Google:", error);
    }
  };

  useEffect(() => {
    if (!assignmentId) return;

    const fetchAssignment = async () => {
      const docRef = doc(db, 'materials', assignmentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setAssignment({ id: snap.id, ...snap.data() } as Material);
      } else {
        setError("Assignment not found");
      }
      setLoading(false);
    };

    fetchAssignment();

    if (auth.currentUser) {
      const q = query(
        collection(db, 'submissions'),
        where('materialId', '==', assignmentId),
        where('uid', '==', auth.currentUser.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setSubmission({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Submission);
        }
      });

      return () => unsubscribe();
    }
  }, [assignmentId]);

  const handleCreateCopy = async () => {
    if (!auth.currentUser || !assignment || !assignment.googleDriveTemplateId) return;
    if (!isGoogleAuth) {
      handleGoogleLogin();
      return;
    }
    setCopying(true);
    setError(null);

    try {
      const res = await fetch('/api/drive/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: assignment.googleDriveTemplateId,
          name: `${assignment.title} - ${auth.currentUser.displayName || 'Student'}`
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create copy");
      }

      const driveFile = await res.json();
      
      const submissionData = {
        materialId: assignment.id,
        uid: auth.currentUser.uid,
        googleDriveFileId: driveFile.id,
        status: 'draft',
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'submissions'), submissionData);
      
    } catch (err: any) {
      setError(err.message || "Failed to create Google Drive copy. Please ensure you have connected your Google account.");
      console.error(err);
    } finally {
      setCopying(false);
    }
  };

  const handleSubmit = async () => {
    if (!submission) return;
    if (!isGoogleAuth) {
      handleGoogleLogin();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/drive/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: submission.googleDriveFileId,
          role: 'reader',
          type: 'anyone'
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update permissions");
      }
      
      await updateDoc(doc(db, 'submissions', submission.id), {
        status: 'submitted',
        submittedAt: serverTimestamp()
      });
    } catch (err: any) {
      setError(err.message || "Failed to submit assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNonZentelleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !assignment) return;
    
    setSubmitting(true);
    try {
      const submissionData = {
        materialId: assignment.id,
        courseId: courseId,
        uid: auth.currentUser.uid,
        studentName: auth.currentUser.displayName || 'Student',
        studentEmail: auth.currentUser.email || '',
        textSubmission: isTextMode ? textSubmission : '',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        timestamp: serverTimestamp()
      };

      if (submission) {
        await updateDoc(doc(db, 'submissions', submission.id), submissionData);
      } else {
        await addDoc(collection(db, 'submissions'), submissionData);
      }
      
      setTextSubmission('');
    } catch (err: any) {
      setError(err.message || "Failed to submit assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004275]"></div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="bg-red-50 p-8 rounded-3xl text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-900">{error || 'Something went wrong'}</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-red-700 font-bold hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-[#004275] font-headline">{assignment.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Posted {assignment.timestamp?.toDate ? new Date(assignment.timestamp.toDate()).toLocaleDateString() : 'Recently'}</span>
              {assignment.dueDate && (
                <span className="flex items-center gap-1 text-red-600 font-bold">
                  <Clock className="w-4 h-4" /> Due {new Date(assignment.dueDate).toLocaleDateString()}
                </span>
              )}
              <span className="flex items-center gap-1 font-bold text-gray-700">
                {assignment.points || 100} points
              </span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <button className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
            <MoreVertical className="w-6 h-6 text-gray-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
              {assignment.description || 'No description provided for this assignment.'}
            </p>
          </div>

          {/* Grading Feedback for Students */}
          {!isAdmin && submission?.grade !== undefined && (
            <div className="bg-green-50 rounded-3xl p-8 border border-green-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-green-900">Grade & Feedback</h2>
                <div className="text-2xl font-black text-green-700">
                  {submission.grade} / {assignment.points || 100}
                </div>
              </div>
              {submission.feedback && (
                <div className="bg-white p-4 rounded-2xl border border-green-200">
                  <p className="text-sm font-bold text-green-800 mb-1">Instructor Feedback:</p>
                  <p className="text-gray-700 italic">"{submission.feedback}"</p>
                </div>
              )}
            </div>
          )}

          {/* Google Drive Section (Zentelle) */}
          {assignment.googleDriveTemplateId ? (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">My Document</h2>
                <div className="flex items-center gap-3">
                  {isGoogleAuth && (
                    <button 
                      onClick={handleGoogleLogout}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Disconnect Google
                    </button>
                  )}
                  {submission?.status === 'submitted' && (
                    <span className="flex items-center gap-1 text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full">
                      <CheckCircle className="w-4 h-4" /> Submitted
                    </span>
                  )}
                </div>
              </div>

              {!submission ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <Cloud className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to start?</h3>
                  <p className="text-gray-500 max-w-xs mx-auto mb-8">
                    Click below to create your own copy of the assignment template in Google Drive.
                  </p>
                  <button 
                    onClick={handleCreateCopy}
                    disabled={copying}
                    className="inline-flex items-center gap-2 bg-[#004275] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:scale-100"
                  >
                    {copying ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                    {copying ? 'Creating Copy...' : 'Create My Copy'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="p-3 bg-blue-600 rounded-xl">
                      <FileText className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-blue-900 truncate">{assignment.title} - {auth.currentUser?.displayName}</h4>
                      <p className="text-sm text-blue-700">Google Doc • Last synced {new Date().toLocaleTimeString()}</p>
                    </div>
                    <a 
                      href={`https://docs.google.com/document/d/${submission.googleDriveFileId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 hover:bg-blue-100 rounded-xl transition-colors text-blue-600"
                    >
                      <ExternalLink className="w-6 h-6" />
                    </a>
                  </div>

                  <div className="flex gap-4">
                    <a 
                      href={`https://docs.google.com/document/d/${submission.googleDriveFileId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-[#004275] text-[#004275] py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                    >
                      <Eye className="w-5 h-5" />
                      Open Document
                    </a>
                    {submission.status === 'draft' ? (
                      <button 
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg disabled:opacity-50"
                      >
                        {submitting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                        {submitting ? 'Submitting...' : 'Submit Assignment'}
                      </button>
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-500 py-4 rounded-2xl font-bold cursor-not-allowed">
                        <Lock className="w-5 h-5" />
                        Submitted (View Only)
                      </div>
                    )}
                  </div>
                  
                  {submission.status === 'submitted' && (
                    <p className="text-center text-sm text-gray-500">
                      Your document is now in view-only mode. Contact your instructor if you need to unsubmit.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Non-Zentelle Submission Section */
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Your Work</h2>
                {submission?.status === 'submitted' && (
                  <span className="flex items-center gap-1 text-green-600 font-bold text-sm bg-green-50 px-3 py-1 rounded-full">
                    <CheckCircle className="w-4 h-4" /> Submitted
                  </span>
                )}
              </div>

              {submission?.status === 'submitted' ? (
                <div className="space-y-4">
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
                    <p className="text-sm font-bold text-gray-500 mb-2">Your Submission:</p>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {submission.textSubmission || 'No text content provided.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-gray-500 text-sm italic">
                    <Lock className="w-4 h-4" /> Submitted on {submission.submittedAt?.toDate ? new Date(submission.submittedAt.toDate()).toLocaleString() : 'Recently'}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleNonZentelleSubmit} className="space-y-6">
                  <div className="flex gap-4 p-1 bg-gray-100 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setIsTextMode(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${!isTextMode ? 'bg-white text-[#004275] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Upload className="w-4 h-4" /> File Upload
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsTextMode(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${isTextMode ? 'bg-white text-[#004275] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <TypeIcon className="w-4 h-4" /> Text
                    </button>
                  </div>

                  {isTextMode ? (
                    <textarea 
                      value={textSubmission}
                      onChange={(e) => setTextSubmission(e.target.value)}
                      placeholder="Type your submission here..."
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all min-h-[200px] resize-none"
                      required
                    />
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                      <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Upload your work</h3>
                      <p className="text-gray-500 max-w-xs mx-auto mb-6">
                        Select a file from your computer to submit for this assignment.
                      </p>
                      <button 
                        type="button"
                        className="bg-white border-2 border-gray-200 text-gray-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all"
                      >
                        Choose File
                      </button>
                      <p className="mt-4 text-xs text-gray-400 italic">(File upload simulation - text mode recommended for now)</p>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={submitting || (isTextMode && !textSubmission.trim())}
                    className="w-full flex items-center justify-center gap-2 bg-[#004275] text-white py-4 rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {submitting ? 'Submitting...' : 'Submit Assignment'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-[#004275]" />
              Submission Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`font-bold ${submission?.status === 'submitted' ? 'text-green-600' : 'text-orange-500'}`}>
                  {submission ? (submission.status === 'submitted' ? 'Submitted' : 'In Progress') : 'Not Started'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Due Date</span>
                <span className={`font-bold ${assignment.dueDate && new Date(assignment.dueDate) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                  {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}
                </span>
              </div>
              {submission?.status === 'submitted' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Submitted On</span>
                  <span className="font-bold text-gray-900">{submission.submittedAt?.toDate ? new Date(submission.submittedAt.toDate()).toLocaleDateString() : new Date().toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#004275]" />
              Comments
            </h3>
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No comments yet.</p>
            </div>
            <div className="mt-4">
              <textarea 
                placeholder="Add a private comment..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all resize-none h-20"
              />
              <button className="mt-2 w-full bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all">
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
