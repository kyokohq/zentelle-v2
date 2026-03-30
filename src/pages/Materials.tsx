import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Folder, 
  FileText, 
  Link as LinkIcon, 
  Plus, 
  ChevronRight, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  FolderPlus, 
  FilePlus, 
  ExternalLink,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List as ListIcon,
  Search,
  Filter,
  X,
  Palette,
  FileCode,
  FileImage,
  FileVideo,
  FileArchive,
  File as FileIcon,
  Share2,
  Download,
  Eye,
  Lock,
  Unlock,
  Cloud,
  Copy
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
  getDocs,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Material, Submission } from '../types';

const COLORS = [
  '#004275', '#0078D4', '#00B7C3', '#107C10', '#D83B01', '#A4262C', '#5C2D91', '#002050',
  '#FFB900', '#E81123', '#B4009E', '#00188F', '#00BCF2', '#BAD80A', '#FF8C00', '#767676'
];

export default function Materials({ 
  userRole, 
  courseId: propCourseId, 
  folderId: propFolderId, 
  onNavigate,
  hideHeader = false
}: { 
  userRole?: string, 
  courseId?: string, 
  folderId?: string, 
  onNavigate?: (path: string) => void,
  hideHeader?: boolean
}) {
  const params = useParams();
  const courseId = propCourseId || params.courseId;
  const folderId = propFolderId || params.folderId;
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterialType, setNewMaterialType] = useState<'folder' | 'assignment' | 'file' | 'link'>('folder');
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialDescription, setNewMaterialDescription] = useState('');
  const [newMaterialColor, setNewMaterialColor] = useState(COLORS[0]);
  const [newMaterialLink, setNewMaterialLink] = useState('');
  const [newMaterialTemplateId, setNewMaterialTemplateId] = useState('');
  const [newMaterialPoints, setNewMaterialPoints] = useState<number>(100);
  const [newMaterialDueDate, setNewMaterialDueDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (!courseId) return;

    // Fetch current folder if folderId is present
    if (folderId) {
      const fetchFolder = async () => {
        const folderDoc = await getDoc(doc(db, 'materials', folderId));
        if (folderDoc.exists()) {
          setCurrentFolder({ id: folderDoc.id, ...folderDoc.data() } as Material);
        }
      };
      fetchFolder();
    } else {
      setCurrentFolder(null);
    }

    // Fetch materials in the current folder/level
    const q = query(
      collection(db, 'materials'),
      where('courseId', '==', courseId),
      where('parentId', '==', folderId || null),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMaterials(materialsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [courseId, folderId]);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !courseId) return;

    const materialData: any = {
      courseId,
      parentId: folderId || null,
      type: newMaterialType,
      title: newMaterialTitle,
      description: newMaterialDescription,
      uid: auth.currentUser.uid,
    };

    if (newMaterialType === 'folder') {
      materialData.color = newMaterialColor;
    } else if (newMaterialType === 'link') {
      materialData.url = newMaterialLink;
    } else if (newMaterialType === 'assignment') {
      materialData.googleDriveTemplateId = newMaterialTemplateId || null;
      materialData.points = newMaterialPoints;
      materialData.dueDate = newMaterialDueDate || null;
    }

    try {
      if (isEditing && editingMaterialId) {
        await updateDoc(doc(db, 'materials', editingMaterialId), materialData);
      } else {
        materialData.timestamp = serverTimestamp();
        materialData.published = true;
        await addDoc(collection(db, 'materials'), materialData);
      }
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving material:", error);
    }
  };

  const handleEditClick = (material: Material) => {
    setIsEditing(true);
    setEditingMaterialId(material.id);
    setNewMaterialType(material.type);
    setNewMaterialTitle(material.title);
    setNewMaterialDescription(material.description || '');
    setNewMaterialColor(material.color || COLORS[0]);
    setNewMaterialLink(material.url || '');
    setNewMaterialTemplateId(material.googleDriveTemplateId || '');
    setNewMaterialPoints(material.points || 100);
    setNewMaterialDueDate(material.dueDate || '');
    setShowAddModal(true);
  };

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  const resetForm = () => {
    setNewMaterialTitle('');
    setNewMaterialDescription('');
    setNewMaterialColor(COLORS[0]);
    setNewMaterialLink('');
    setNewMaterialTemplateId('');
    setNewMaterialPoints(100);
    setNewMaterialDueDate('');
    setIsEditing(false);
    setEditingMaterialId(null);
  };

  const deleteMaterial = async (id: string) => {
    setIsDeleting(true);
    try {
      const materialDoc = await getDoc(doc(db, 'materials', id));
      if (!materialDoc.exists()) {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }
      const material = { id: materialDoc.id, ...materialDoc.data() } as Material;

      if (material.type === 'folder') {
        // Recursively delete child materials
        const deleteChildren = async (parentId: string) => {
          const q = query(collection(db, 'materials'), where('parentId', '==', parentId));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          
          for (const docSnap of snapshot.docs) {
            const child = { id: docSnap.id, ...docSnap.data() } as Material;
            if (child.type === 'folder') {
              await deleteChildren(child.id);
            }
            batch.delete(docSnap.ref);
          }
          await batch.commit();
        };
        await deleteChildren(id);
      }

      await deleteDoc(doc(db, 'materials', id));
      setShowDeleteConfirm(false);
      setMaterialToDelete(null);
    } catch (error) {
      console.error("Error deleting material:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePublish = async (material: Material) => {
    try {
      await updateDoc(doc(db, 'materials', material.id), {
        published: !material.published
      });
    } catch (error) {
      console.error("Error toggling publish status:", error);
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIcon = (type: string, color?: string) => {
    switch (type) {
      case 'folder': return <Folder className="w-10 h-10" style={{ color: color || '#004275' }} />;
      case 'assignment': return <FileText className="w-10 h-10 text-orange-500" />;
      case 'file': return <FileIcon className="w-10 h-10 text-blue-500" />;
      case 'link': return <LinkIcon className="w-10 h-10 text-green-500" />;
      default: return <FileIcon className="w-10 h-10 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004275]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div className="flex items-center gap-3">
            {folderId && (
              <button 
                onClick={() => handleNavigate(-1 as any)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-black text-[#004275] font-headline">
                {currentFolder ? currentFolder.title : 'Course Materials'}
              </h1>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <button onClick={() => handleNavigate(`/courses/${courseId}`)} className="hover:text-[#004275] hover:underline">Course</button>
                <ChevronRight className="w-4 h-4 mx-1" />
                <button onClick={() => handleNavigate(`/courses/${courseId}/materials`)} className="hover:text-[#004275] hover:underline">Materials</button>
                {currentFolder && (
                  <>
                    <ChevronRight className="w-4 h-4 mx-1" />
                    <span className="text-[#004275] font-medium">{currentFolder.title}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-[#004275] text-white px-6 py-3 rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Material
              </button>
            )}
          </div>
        </div>
      )}

      {hideHeader && folderId && (
        <div className="mb-6 flex items-center gap-3">
          <button 
            onClick={() => handleNavigate(-1 as any)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-xl font-bold text-gray-900">{currentFolder?.title}</h2>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none w-full md:w-64"
            />
          </div>
          <div className="flex bg-white border border-gray-200 rounded-xl p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#004275] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <ListIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        {isAdmin && hideHeader && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#004275] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#005a9c] transition-all active:scale-95 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Material
          </button>
        )}
      </div>

      {/* Materials Grid/List */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Folder className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No materials found</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-8">
            {searchQuery ? "No materials match your search query." : "This folder is empty. Start by adding some course materials."}
          </p>
          {isAdmin && !searchQuery && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 text-[#004275] font-bold hover:underline"
            >
              <Plus className="w-5 h-5" />
              Add your first material
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
          <AnimatePresence mode="popLayout">
            {filteredMaterials.map((material) => (
              <motion.div
                key={material.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={viewMode === 'grid' ? "group" : ""}
              >
                {viewMode === 'grid' ? (
                  <div className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all border border-gray-100 relative overflow-hidden">
                    {material.type === 'folder' && (
                      <div 
                        className="absolute top-0 left-0 w-full h-1.5" 
                        style={{ backgroundColor: material.color || '#004275' }}
                      />
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gray-50 rounded-2xl group-hover:scale-110 transition-transform relative">
                        {getIcon(material.type, material.color)}
                        {!material.published && isAdmin && (
                          <div className="absolute -top-1 -right-1 bg-gray-500 text-white p-1 rounded-full shadow-sm" title="Unpublished">
                            <Lock className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => togglePublish(material)}
                            className={`p-2 rounded-full transition-colors ${material.published ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                            title={material.published ? 'Unpublish' : 'Publish'}
                          >
                            {material.published ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => handleEditClick(material)}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#004275]"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setMaterialToDelete(material.id);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        if (material.type === 'folder') {
                          handleNavigate(`/courses/${courseId}/materials/${material.id}`);
                        } else if (material.type === 'link' && material.url) {
                          window.open(material.url, '_blank');
                        } else if (material.type === 'file' && material.url) {
                          window.open(material.url, '_blank');
                        } else {
                          handleNavigate(`/courses/${courseId}/assignments/${material.id}`);
                        }
                      }}
                      className="block text-left w-full"
                    >
                      <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#004275] transition-colors line-clamp-1">
                        {material.title}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">
                        {material.description || 'No description provided.'}
                      </p>
                    </button>
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1 uppercase tracking-wider font-bold">
                        {material.type}
                      </span>
                      <span>{new Date(material.timestamp?.toDate()).toLocaleDateString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-100 flex items-center gap-4 group">
                    <div className="p-2 bg-gray-50 rounded-xl relative">
                      {getIcon(material.type, material.color)}
                      {!material.published && isAdmin && (
                        <div className="absolute -top-1 -right-1 bg-gray-500 text-white p-0.5 rounded-full shadow-sm" title="Unpublished">
                          <Lock className="w-2 h-2" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button 
                        onClick={() => {
                          if (material.type === 'folder') {
                            handleNavigate(`/courses/${courseId}/materials/${material.id}`);
                          } else if (material.type === 'link' && material.url) {
                            window.open(material.url, '_blank');
                          } else if (material.type === 'file' && material.url) {
                            window.open(material.url, '_blank');
                          } else {
                            handleNavigate(`/courses/${courseId}/assignments/${material.id}`);
                          }
                        }}
                        className="text-lg font-bold text-gray-900 hover:text-[#004275] transition-colors truncate block text-left w-full"
                      >
                        {material.title}
                      </button>
                      <p className="text-sm text-gray-500 truncate">{material.description}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-sm text-gray-400 px-4">
                      <span className="uppercase tracking-wider font-bold">{material.type}</span>
                      <span>{new Date(material.timestamp?.toDate()).toLocaleDateString()}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => togglePublish(material)}
                          className={`p-2 rounded-full transition-colors ${material.published ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                          title={material.published ? 'Unpublish' : 'Publish'}
                        >
                          {material.published ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleEditClick(material)}
                          className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#004275]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setMaterialToDelete(material.id);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-[#004275] font-headline">
                {isEditing ? 'Edit Material' : 'Add Course Material'}
              </h2>
              <button 
                onClick={() => { setShowAddModal(false); resetForm(); }} 
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddMaterial} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'folder', label: 'Folder', icon: FolderPlus, color: 'text-blue-600' },
                  { id: 'assignment', label: 'Assignment', icon: FilePlus, color: 'text-orange-600' },
                  { id: 'file', label: 'File', icon: FileIcon, color: 'text-blue-500' },
                  { id: 'link', label: 'Link', icon: LinkIcon, color: 'text-green-600' }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setNewMaterialType(type.id as any)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      newMaterialType === type.id 
                        ? 'border-[#004275] bg-[#004275]/5' 
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <type.icon className={`w-8 h-8 ${type.color}`} />
                    <span className="text-sm font-bold text-gray-700">{type.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                  <input 
                    type="text" 
                    required
                    value={newMaterialTitle}
                    onChange={(e) => setNewMaterialTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                    placeholder={`Enter ${newMaterialType} title...`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Description (Optional)</label>
                  <textarea 
                    value={newMaterialDescription}
                    onChange={(e) => setNewMaterialDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all resize-none h-24"
                    placeholder="Add some details about this material..."
                  />
                </div>

                {newMaterialType === 'folder' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Folder Color</label>
                    <div className="grid grid-cols-8 gap-2">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewMaterialColor(color)}
                          className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${
                            newMaterialColor === color ? 'ring-2 ring-offset-2 ring-[#004275] scale-110' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {newMaterialColor === color && <div className="w-2 h-2 bg-white rounded-full" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {newMaterialType === 'link' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">URL</label>
                    <input 
                      type="url" 
                      required
                      value={newMaterialLink}
                      onChange={(e) => setNewMaterialLink(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {newMaterialType === 'assignment' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Points</label>
                        <input 
                          type="number" 
                          value={newMaterialPoints}
                          onChange={(e) => setNewMaterialPoints(parseInt(e.target.value))}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                          placeholder="Max points..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Due Date</label>
                        <input 
                          type="datetime-local" 
                          value={newMaterialDueDate}
                          onChange={(e) => setNewMaterialDueDate(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className={`p-6 rounded-2xl border transition-all ${isGoogleAuth ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isGoogleAuth ? 'bg-green-600' : 'bg-blue-600'}`}>
                          <Cloud className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className={`font-bold ${isGoogleAuth ? 'text-green-900' : 'text-blue-900'}`}>Google Drive Integration</h4>
                          <p className={`text-xs ${isGoogleAuth ? 'text-green-700' : 'text-blue-700'}`}>
                            {isGoogleAuth ? 'Connected to Google Drive' : 'Connect a template to automatically create copies for students.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isGoogleAuth ? (
                          <button 
                            type="button"
                            onClick={handleGoogleLogout}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all text-sm"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onClick={handleGoogleLogin}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all text-sm"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                    {isGoogleAuth && (
                      <div className="space-y-3">
                        <label className="block text-sm font-bold text-green-900">Google Drive Template ID</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newMaterialTemplateId}
                            onChange={(e) => setNewMaterialTemplateId(e.target.value)}
                            className="flex-1 px-4 py-2 bg-white border border-green-200 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none transition-all"
                            placeholder="Paste Google Drive File ID..."
                          />
                          <button 
                            type="button"
                            className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                          >
                            <Search className="w-4 h-4" />
                            Browse
                          </button>
                        </div>
                        <p className="text-[10px] text-green-600">
                          Tip: Open your Google Doc, the ID is the long string between /d/ and /edit in the URL.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-[#004275] text-white rounded-2xl font-bold hover:bg-[#005a9c] transition-all shadow-lg"
                >
                  {isEditing ? 'Save Changes' : 'Create Material'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
          >
            <div className="text-center">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Material?</h3>
              <p className="text-gray-500 mb-8">
                Are you sure you want to delete this material? This action cannot be undone and will delete all contents if it's a folder.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setMaterialToDelete(null);
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => materialToDelete && deleteMaterial(materialToDelete)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : 'Delete'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
