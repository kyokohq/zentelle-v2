import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Folder, 
  FileText, 
  Link as LinkIcon, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  MoreVertical, 
  Trash2, 
  Edit2, 
  FolderPlus, 
  FilePlus, 
  ExternalLink,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
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
  Copy,
  GripVertical,
  Trophy
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
import { handleFirestoreError, OperationType } from '../lib/utils';
import { useDialog } from '../context/DialogContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLORS = [
  '#004275', '#0078D4', '#00B7C3', '#107C10', '#D83B01', '#A4262C', '#5C2D91', '#002050',
  '#FFB900', '#E81123', '#B4009E', '#00188F', '#00BCF2', '#BAD80A', '#FF8C00', '#767676'
];

function MaterialItem({ 
  material, 
  viewMode, 
  isAdmin, 
  courseId, 
  handleNavigate, 
  togglePublish, 
  handleEditClick, 
  getIcon, 
  onMoveClick,
  isExpanded,
  onToggleExpand,
  showConfirm,
  deleteMaterial,
  children
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: material.id, disabled: !isAdmin });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  if (viewMode === 'grid') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="group"
      >
        <div className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all border border-gray-100 relative overflow-hidden h-full flex flex-col">
          {material.type === 'folder' && (
            <div 
              className="absolute top-0 left-0 w-full h-1.5" 
              style={{ backgroundColor: material.color || '#004275' }}
            />
          )}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              {isAdmin && (
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded text-gray-400">
                  <GripVertical className="w-4 h-4" />
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-2xl group-hover:scale-110 transition-transform relative">
                {getIcon(material.type, material.color)}
                {!material.published && isAdmin && (
                  <div className="absolute -top-1 -right-1 bg-gray-500 text-white p-1 rounded-full shadow-sm" title="Unpublished">
                    <Lock className="w-3 h-3" />
                  </div>
                )}
              </div>
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
                  onClick={() => onMoveClick(material)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#004275]"
                  title="Move to folder"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={async () => {
                    const confirmed = await showConfirm("Are you sure you want to delete this material? This action cannot be undone and will delete all contents if it's a folder.", "Delete Material");
                    if (confirmed) {
                      deleteMaterial(material.id);
                    }
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
            className="block text-left w-full flex-grow"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#004275] transition-colors line-clamp-1">
              {material.title}
            </h3>
            <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">
              {material.description || 'No description provided.'}
            </p>
          </button>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {material.timestamp?.toDate ? material.timestamp.toDate().toLocaleDateString() : 'Just now'}
            </div>
            {material.type === 'assignment' && material.points && (
              <div className="font-medium text-[#004275] bg-blue-50 px-2 py-0.5 rounded-full">
                {material.points} pts
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="material-item-wrapper">
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-100 flex items-center justify-between gap-4 group"
    >
      <div className="flex items-center gap-4 flex-1">
        {material.type === 'folder' && viewMode === 'list' && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(material.id);
            }}
            className="p-1 -ml-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#004275] transition-all"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        {isAdmin && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded text-gray-400">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="p-2 bg-gray-50 rounded-xl relative shrink-0">
          {getIcon(material.type, material.color)}
          {!material.published && isAdmin && (
            <div className="absolute -top-1 -right-1 bg-gray-500 text-white p-0.5 rounded-full shadow-sm" title="Unpublished">
              <Lock className="w-2 h-2" />
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
          className="text-left min-w-0"
        >
          <h3 className="font-bold text-gray-900 group-hover:text-[#004275] transition-colors truncate">{material.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-1">{material.description}</p>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {material.type === 'assignment' && material.points && (
          <div className="hidden sm:block text-xs font-medium text-[#004275] bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
            {material.points} pts
          </div>
        )}
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
              onClick={() => onMoveClick(material)}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#004275]"
              title="Move to folder"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button 
              onClick={async () => {
                const confirmed = await showConfirm("Are you sure you want to delete this material? This action cannot be undone and will delete all contents if it's a folder.", "Delete Material");
                if (confirmed) {
                  deleteMaterial(material.id);
                }
              }}
              className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Non-folder list items still get a right chevron for consistency, but folders now use the left one */}
        {material.type !== 'folder' && (
          <ChevronRight className="w-5 h-5 text-gray-300" />
        )}
      </div>
    </div>
    {isExpanded && children && (
      <div className="ml-8 border-l-2 border-gray-100 pl-4 space-y-3 mt-3">
        {children}
      </div>
    )}
    </div>
  );
}

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
  const { showAlert, showConfirm } = useDialog();
  const params = useParams();
  const courseId = propCourseId || params.courseId;
  const folderId = propFolderId || params.folderId;
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterialType, setNewMaterialType] = useState<'folder' | 'assignment' | 'file' | 'link' | 'quiz' | 'worksheet'>('folder');
  const [showQuizCreator, setShowQuizCreator] = useState(false);
  const [showQuizPlayer, setShowQuizPlayer] = useState(false);
  const [showInteractiveWorksheet, setShowInteractiveWorksheet] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialDescription, setNewMaterialDescription] = useState('');
  const [newMaterialColor, setNewMaterialColor] = useState(COLORS[0]);
  const [newMaterialLink, setNewMaterialLink] = useState('');
  const [newMaterialFile, setNewMaterialFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newMaterialTemplateId, setNewMaterialTemplateId] = useState('');
  const [newMaterialTemplateType, setNewMaterialTemplateType] = useState<'document' | 'presentation' | 'spreadsheet'>('document');
  const [newMaterialPoints, setNewMaterialPoints] = useState<number>(100);
  const [newMaterialDueDate, setNewMaterialDueDate] = useState('');
  const [newMaterialPublished, setNewMaterialPublished] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [materialToMove, setMaterialToMove] = useState<Material | null>(null);
  const [allFolders, setAllFolders] = useState<Material[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [inlineAddIndex, setInlineAddIndex] = useState<number | null>(null);
  const [inlineAddParentId, setInlineAddParentId] = useState<string | null>(null);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInlineAdd = (index: number, parentId: string | null = null) => {
    setInlineAddIndex(index);
    setInlineAddParentId(parentId);
    setShowAddModal(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!courseId || !isAdmin) return;
    const qFolders = query(
      collection(db, 'materials'),
      where('courseId', '==', courseId),
      where('type', '==', 'folder')
    );
    const unsub = onSnapshot(qFolders, (snap) => {
      setAllFolders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materials/folders'));
    return () => unsub();
  }, [courseId, isAdmin]);

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
        try {
          const folderDoc = await getDoc(doc(db, 'materials', folderId));
          if (folderDoc.exists()) {
            setCurrentFolder({ id: folderDoc.id, ...folderDoc.data() } as Material);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `materials/${folderId}`);
        }
      };
      fetchFolder();
    } else {
      setCurrentFolder(null);
    }

    // Fetch materials in the current folder/level
    let q;
    if (isAdmin) {
      q = query(
        collection(db, 'materials'),
        where('courseId', '==', courseId),
        where('parentId', '==', folderId || null),
        orderBy('order', 'asc')
      );
    } else {
      q = query(
        collection(db, 'materials'),
        where('courseId', '==', courseId),
        where('parentId', '==', folderId || null),
        where('published', '==', true),
        orderBy('order', 'asc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const materialsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMaterials(materialsData);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `materials/${folderId || 'root'}`));

    return () => unsubscribe();
  }, [courseId, folderId]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !isAdmin) return;

    const activeMaterial = materials.find(m => m.id === active.id);
    if (!activeMaterial) return;

    // Reorder within the same level
    if (active.id !== over.id) {
      const oldIndex = materials.findIndex(m => m.id === active.id);
      const newIndex = materials.findIndex(m => m.id === over.id);

      const newMaterials = arrayMove(materials, oldIndex, newIndex);
      setMaterials(newMaterials);

      // Update all orders in Firestore
      const batch = writeBatch(db);
      newMaterials.forEach((m, index) => {
        const materialRef = doc(db, 'materials', m.id);
        batch.update(materialRef, { order: index });
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'materials/reorder');
      }
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !courseId) return;

    const materialData: any = {
      courseId,
      parentId: inlineAddParentId !== null ? inlineAddParentId : (folderId || null),
      type: newMaterialType,
      title: newMaterialTitle,
      description: newMaterialDescription,
      uid: auth.currentUser.uid,
      order: inlineAddIndex !== null ? inlineAddIndex : materials.length,
      timestamp: serverTimestamp(),
      published: newMaterialPublished,
    };

    if (inlineAddIndex !== null) {
      // Shift existing materials
      const batch = writeBatch(db);
      const levelMaterials = inlineAddParentId 
        ? materials.filter(m => m.parentId === inlineAddParentId) // This is tricky if it's nested
        : materials;
        
      // For now, simpler: re-fetch and re-order OR just append if simpler.
      // Better way: Get all materials at this parentId and update their orders.
      const q = query(
        collection(db, 'materials'),
        where('courseId', '==', courseId),
        where('parentId', '==', materialData.parentId)
      );
      try {
        const snap = await getDocs(q);
        const existingAtLevel = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Material))
          .sort((a,b) => (a.order || 0) - (b.order || 0));

        existingAtLevel.forEach((m, i) => {
          if (i >= inlineAddIndex) {
            batch.update(doc(db, 'materials', m.id), { order: i + 1 });
          }
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'materials/inline-add-reorder');
      }
    }

    if (newMaterialType === 'folder') {
      materialData.color = newMaterialColor;
    } else if (newMaterialType === 'link') {
      materialData.url = newMaterialLink;
    } else if (newMaterialType === 'file' || newMaterialType === 'worksheet') {
      materialData.url = newMaterialFile || newMaterialLink || 'https://picsum.photos/seed/worksheet/800/1000';
    } else if (newMaterialType === 'assignment' || newMaterialType === 'quiz') {
      materialData.googleDriveTemplateId = newMaterialTemplateId || null;
      materialData.googleDriveTemplateType = newMaterialTemplateId ? newMaterialTemplateType : null;
      materialData.points = newMaterialPoints;
      materialData.dueDate = newMaterialDueDate || null;
    }

    try {
      if (isEditing && editingMaterialId) {
        await updateDoc(doc(db, 'materials', editingMaterialId), materialData);
      } else {
        await addDoc(collection(db, 'materials'), materialData);
      }
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, isEditing ? `materials/${editingMaterialId}` : 'materials');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        await showAlert("File size exceeds 10MB limit.", "File Too Large");
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMaterialFile(reader.result as string);
        if (!newMaterialTitle) setNewMaterialTitle(file.name);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
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
    setNewMaterialFile(material.type === 'file' ? material.url || '' : null);
    setNewMaterialTemplateId(material.googleDriveTemplateId || '');
    setNewMaterialTemplateType(material.googleDriveTemplateType || 'document');
    setNewMaterialPoints(material.points || 100);
    setNewMaterialDueDate(material.dueDate || '');
    setNewMaterialPublished(material.published ?? true);
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
    setNewMaterialFile(null);
    setIsUploading(false);
    setNewMaterialTemplateId('');
    setNewMaterialTemplateType('document');
    setNewMaterialPoints(100);
    setNewMaterialDueDate('');
    setNewMaterialPublished(true);
    setIsEditing(false);
    setEditingMaterialId(null);
    setInlineAddIndex(null);
    setInlineAddParentId(null);
  };

  const deleteMaterial = async (id: string) => {
    try {
      const materialDoc = await getDoc(doc(db, 'materials', id));
      if (!materialDoc.exists()) return;
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
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `materials/${id}`);
    }
  };
  const togglePublish = async (material: Material) => {
    try {
      await updateDoc(doc(db, 'materials', material.id), {
        published: !material.published
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `materials/${material.id}`);
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIcon = (type: string, color?: string) => {
    switch (type) {
      case 'folder': return <Folder className="w-10 h-10" style={{ color: color || '#004275' }} />;
      case 'assignment': return <FileText className="w-10 h-10 text-orange-500" />;
      case 'quiz': return <Trophy className="w-10 h-10 text-purple-500" />;
      case 'worksheet': return <Palette className="w-10 h-10 text-pink-500" />;
      case 'file': return <FileIcon className="w-10 h-10 text-blue-500" />;
      case 'link': return <LinkIcon className="w-10 h-10 text-green-500" />;
      default: return <FileIcon className="w-10 h-10 text-gray-500" />;
    }
  };

  const AddIndicator = ({ index, parentId }: { index: number, parentId: string | null }) => {
    if (!isAdmin || viewMode !== 'list') return null;
    return (
      <div className="relative h-4 group/indicator -my-2 flex items-center justify-center z-10">
        <div className="absolute inset-0 opacity-0 group-hover/indicator:opacity-100 flex items-center justify-center transition-all">
          <div className="w-full h-0.5 bg-[#004275]/20 absolute" />
          <button 
            onClick={() => handleInlineAdd(index, parentId)}
            className="flex items-center gap-2 px-3 py-1 bg-[#004275] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-110 transition-all z-20"
          >
            <Plus className="w-3 h-3" />
            Add material
          </button>
        </div>
      </div>
    );
  };

  const FolderContents = ({ parentId, depth = 0 }: { parentId: string, depth?: number }) => {
    const [contents, setContents] = useState<Material[]>([]);
    
    useEffect(() => {
      const q = query(
        collection(db, 'materials'),
        where('courseId', '==', courseId),
        where('parentId', '==', parentId),
        orderBy('order', 'asc')
      );
      return onSnapshot(q, (snap) => {
        setContents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, `materials/folder/${parentId}`));
    }, [parentId]);

    return (
      <div className="space-y-3">
        <AddIndicator index={0} parentId={parentId} />
        {contents.map((m, idx) => (
          <div key={m.id}>
            <MaterialItem
              material={m}
              viewMode="list"
              isAdmin={isAdmin}
              courseId={courseId}
              handleNavigate={handleNavigate}
              togglePublish={togglePublish}
              handleEditClick={handleEditClick}
              getIcon={getIcon}
              onMoveClick={(mat: any) => {
                setMaterialToMove(mat);
                setShowMoveModal(true);
              }}
              isExpanded={expandedFolders.has(m.id)}
              onToggleExpand={toggleFolder}
              showConfirm={showConfirm}
              deleteMaterial={deleteMaterial}
            >
              {expandedFolders.has(m.id) && (
                <FolderContents parentId={m.id} depth={depth + 1} />
              )}
            </MaterialItem>
            <AddIndicator index={idx + 1} parentId={parentId} />
          </div>
        ))}
      </div>
    );
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
        isAdmin ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
            <SortableContext
              items={filteredMaterials.map(m => m.id)}
              strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
            >
              <AnimatePresence mode="popLayout">
                {viewMode === 'list' && <AddIndicator index={0} parentId={folderId || null} />}
                {filteredMaterials.map((material, idx) => (
                  <div key={material.id}>
                    <MaterialItem
                      material={material}
                      viewMode={viewMode}
                      isAdmin={isAdmin}
                      courseId={courseId}
                      handleNavigate={handleNavigate}
                      togglePublish={togglePublish}
                      handleEditClick={handleEditClick}
                      getIcon={getIcon}
                      onMoveClick={(m: any) => {
                        setMaterialToMove(m);
                        setShowMoveModal(true);
                      }}
                      isExpanded={expandedFolders.has(material.id)}
                      onToggleExpand={toggleFolder}
                      showConfirm={showConfirm}
                      deleteMaterial={deleteMaterial}
                    >
                      {expandedFolders.has(material.id) && (
                        <FolderContents parentId={material.id} />
                      )}
                    </MaterialItem>
                    {viewMode === 'list' && <AddIndicator index={idx + 1} parentId={folderId || null} />}
                  </div>
                ))}
              </AnimatePresence>
            </SortableContext>
          </div>
        </DndContext>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
          <AnimatePresence mode="popLayout">
            {filteredMaterials.map((material) => (
              <MaterialItem
                key={material.id}
                material={material}
                viewMode={viewMode}
                isAdmin={isAdmin}
                courseId={courseId}
                handleNavigate={handleNavigate}
                togglePublish={togglePublish}
                handleEditClick={handleEditClick}
                getIcon={getIcon}
                onMoveClick={(m: any) => {
                  setMaterialToMove(m);
                  setShowMoveModal(true);
                }}
                isExpanded={expandedFolders.has(material.id)}
                onToggleExpand={toggleFolder}
                showConfirm={showConfirm}
                deleteMaterial={deleteMaterial}
              >
                {expandedFolders.has(material.id) && (
                  <FolderContents parentId={material.id} />
                )}
              </MaterialItem>
            ))}
          </AnimatePresence>
        </div>
      )
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: 'folder', label: 'Folder', icon: FolderPlus, color: 'text-blue-600' },
                  { id: 'assignment', label: 'Assignment', icon: FilePlus, color: 'text-orange-600' },
                  { id: 'quiz', label: 'Quiz', icon: Trophy, color: 'text-purple-600' },
                  { id: 'worksheet', label: 'Worksheet', icon: Palette, color: 'text-pink-600' },
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
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Title</label>
                  <input 
                    type="text" 
                    required
                    value={newMaterialTitle}
                    onChange={(e) => setNewMaterialTitle(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all font-bold"
                    placeholder={`Enter ${newMaterialType} title...`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Description (Optional)</label>
                  <textarea 
                    value={newMaterialDescription}
                    onChange={(e) => setNewMaterialDescription(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all resize-none h-24"
                    placeholder={newMaterialType === 'worksheet' ? "Add instructions for completing the worksheet..." : "Add some details about this material..."}
                  />
                </div>

                {newMaterialType === 'folder' && (
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Folder Color</label>
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
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">URL</label>
                    <input 
                      type="url" 
                      required
                      value={newMaterialLink}
                      onChange={(e) => setNewMaterialLink(e.target.value)}
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {(newMaterialType === 'file' || newMaterialType === 'worksheet') && (
                  <div className="space-y-4">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                       {newMaterialType === 'worksheet' ? 'Upload Worksheet (Image/PDF)' : 'Upload File'}
                    </label>
                    <div className="p-8 border-2 border-dashed border-gray-200 rounded-[32px] bg-gray-50/50 hover:border-[#004275]/20 hover:bg-[#004275]/5 transition-all text-center group cursor-pointer relative">
                      <input 
                        type="file" 
                        id="material-file-upload" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                      <label htmlFor="material-file-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center gap-3">
                          <div className={`p-4 rounded-2xl bg-white shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${isUploading ? 'animate-pulse' : ''}`}>
                            {isUploading ? (
                              <Loader2 className="w-8 h-8 text-[#004275] animate-spin" />
                            ) : (
                              <Plus className="w-8 h-8 text-[#004275] border-none" />
                            )}
                          </div>
                          <div>
                            <p className="text-lg font-black text-gray-900 font-headline">
                              {newMaterialFile ? 'File Selected' : (newMaterialType === 'worksheet' ? 'Select Worksheet Image' : 'Click to Upload')}
                            </p>
                            <p className="text-sm text-gray-500 font-medium">Click to select or drag and drop</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {(newMaterialType === 'assignment' || newMaterialType === 'quiz' || newMaterialType === 'worksheet') && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Max Points</label>
                        <input 
                          type="number" 
                          value={newMaterialPoints}
                          onChange={(e) => setNewMaterialPoints(parseInt(e.target.value))}
                          className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                          placeholder="Max points..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Due Date</label>
                        <input 
                          type="date" 
                          value={newMaterialDueDate}
                          onChange={(e) => setNewMaterialDueDate(e.target.value)}
                          className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#004275] focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>

                    {(newMaterialType === 'assignment' || newMaterialType === 'quiz') && (
                      <div className={`p-6 rounded-3xl border transition-all ${isGoogleAuth ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isGoogleAuth ? 'bg-green-600' : 'bg-blue-600'}`}>
                              <Cloud className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className={`font-bold ${isGoogleAuth ? 'text-green-900' : 'text-blue-900'}`}>Drive Template</h4>
                              <p className={`text-xs ${isGoogleAuth ? 'text-green-700' : 'text-blue-700'}`}>
                                {isGoogleAuth ? 'Students will get a copy of this file.' : 'Connect to use Google Drive templates.'}
                              </p>
                            </div>
                          </div>
                          {!isGoogleAuth && (
                             <button 
                              type="button"
                              onClick={handleGoogleLogin}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all text-sm"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                        {isGoogleAuth && (
                          <div className="space-y-3">
                            <input 
                              type="text" 
                              value={newMaterialTemplateId}
                              onChange={(e) => setNewMaterialTemplateId(e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-green-200 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-transparent outline-none transition-all text-sm"
                              placeholder="Paste Google Drive File ID..."
                            />
                            <div className="flex gap-2 p-1 bg-white/50 rounded-xl border border-green-100">
                              {[
                                { id: 'document', label: 'Docs', icon: FileText },
                                { id: 'presentation', label: 'Slides', icon: Eye },
                                { id: 'spreadsheet', label: 'Sheets', icon: ListIcon }
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  type="button"
                                  onClick={() => setNewMaterialTemplateType(type.id as any)}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                                    newMaterialTemplateType === type.id 
                                      ? 'bg-green-600 text-white shadow-sm' 
                                      : 'text-green-700 hover:bg-green-100/50'
                                  }`}
                                >
                                  {type.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className={`p-2 rounded-lg ${newMaterialPublished ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                    {newMaterialPublished ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">Publish Material</p>
                    <p className="text-xs text-gray-500">Visible to students immediately</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewMaterialPublished(!newMaterialPublished)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${newMaterialPublished ? 'bg-[#004275]' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${newMaterialPublished ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
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
      {/* Move Material Modal */}
      {showMoveModal && materialToMove && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-[#004275] font-headline">Move Material</h2>
              <button onClick={() => setShowMoveModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              Select where you want to move <span className="font-bold text-gray-900">"{materialToMove.title}"</span>:
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto mb-8 pr-2">
              <button 
                onClick={async () => {
                  setIsMoving(true);
                  try {
                    await updateDoc(doc(db, 'materials', materialToMove.id), { parentId: null });
                    setShowMoveModal(false);
                    setMaterialToMove(null);
                  } catch (e) {
                    handleFirestoreError(e, OperationType.UPDATE, `materials/${materialToMove.id}`);
                  } finally {
                    setIsMoving(false);
                  }
                }}
                disabled={isMoving || materialToMove.parentId === null}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  materialToMove.parentId === null 
                    ? 'bg-[#004275]/5 border-[#004275] text-[#004275]' 
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                } group`}
              >
                <div className={`p-2 rounded-xl transition-colors ${materialToMove.parentId === null ? 'bg-[#004275] text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <span className="font-bold">Root (No Folder)</span>
              </button>

              {allFolders
                .filter(f => f.id !== materialToMove.id) // Can't move into itself
                .map((folder) => (
                  <button 
                    key={folder.id}
                    onClick={async () => {
                      setIsMoving(true);
                      try {
                        await updateDoc(doc(db, 'materials', materialToMove.id), { parentId: folder.id });
                        setShowMoveModal(false);
                        setMaterialToMove(null);
                      } catch (e) {
                        handleFirestoreError(e, OperationType.UPDATE, `materials/${materialToMove.id}`);
                      } finally {
                        setIsMoving(false);
                      }
                    }}
                    disabled={isMoving || materialToMove.parentId === folder.id}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      materialToMove.parentId === folder.id 
                        ? 'bg-[#004275]/5 border-[#004275] text-[#004275]' 
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    } group`}
                  >
                    <div className={`p-2 rounded-xl transition-colors ${materialToMove.parentId === folder.id ? 'bg-[#004275] text-white' : 'bg-gray-100 text-gray-400'}`}>
                      <Folder className="w-4 h-4" />
                    </div>
                    <span className="font-bold truncate">{folder.title}</span>
                  </button>
                ))}
            </div>

            <button 
              onClick={() => setShowMoveModal(false)}
              className="w-full py-4 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
