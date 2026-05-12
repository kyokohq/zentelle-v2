import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import { 
  Square, 
  Circle, 
  Type, 
  Eraser, 
  Undo2, 
  Save, 
  ArrowLeft,
  X,
  Target,
  Image as ImageIcon,
  FileText,
  Search,
  Layout,
  ColumnsIcon,
  ChevronDown,
  Zap,
  Columns2,
  Columns3,
  SearchIcon,
  MousePointer2,
  Download,
  CheckCircle2,
  Loader2,
  Trash2,
  AlertCircle,
  Info,
  Upload,
  ImagePlus,
  FileUp,
  Files
} from 'lucide-react';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Material, Submission, HotspotData } from '../types';

interface InteractiveWorksheetProps {
  materialId: string;
  courseId: string;
  userRole?: string;
  onClose: () => void;
}

export function InteractiveWorksheet({ materialId, courseId, userRole, onClose }: InteractiveWorksheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'rect' | 'circle' | 'draw' | 'hotspot' | 'check' | 'line'>('select');
  const [selectedHotspot, setSelectedHotspot] = useState<fabric.Object | null>(null);
  const [updateVersion, setUpdateVersion] = useState(0);
  const isAdmin = userRole === 'admin';
  const isActuallyStudent = !isAdmin || isPreviewMode;

  const [zoom, setZoom] = useState(1);
  const [nativeDimensions, setNativeDimensions] = useState({ width: 1000, height: 1000 });

  useEffect(() => {
    loadData();
  }, [materialId]);

  const handleZoom = (level: number) => {
    if (!fabricCanvas) return;
    const newZoom = Math.min(Math.max(level, 0.1), 3);
    setZoom(newZoom);
    
    // Scale canvas dimensions based on zoom
    const bg = fabricCanvas.backgroundImage as fabric.Image;
    if (bg) {
      fabricCanvas.setDimensions({
        width: bg.width! * newZoom,
        height: bg.height! * newZoom
      });
      fabricCanvas.setZoom(newZoom);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const matDoc = await getDoc(doc(db, 'materials', materialId));
      if (matDoc.exists()) {
        const matData = { id: matDoc.id, ...matDoc.data() } as Material;
        setMaterial(matData);

        // If student, check for existing submission
        if (auth.currentUser && !isAdmin) {
          const subId = `${auth.currentUser.uid}_${materialId}`;
          const subDoc = await getDoc(doc(db, 'submissions', subId));
          if (subDoc.exists()) {
            setSubmission({ id: subDoc.id, ...subDoc.data() } as Submission);
          }
        }
      }
    } catch (error) {
      console.error("Error loading worksheet data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && canvasRef.current && material) {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: nativeDimensions.width * zoom,
        height: nativeDimensions.height * zoom,
        backgroundColor: '#fff',
      });
      canvas.setZoom(zoom);

      // Load background image
      const loadBackground = async () => {
        if (!material.url) return;

        try {
          let imageUrl = material.url;
          
          // Check if it's a PDF
          if (material.url.toLowerCase().includes('.pdf') || material.url.startsWith('data:application/pdf')) {
            const loadingTask = pdfjs.getDocument(material.url);
            const pdf = await loadingTask.promise;
            
            // Render all pages for background mode
            const pages: HTMLCanvasElement[] = [];
            let totalHeight = 0;
            let maxWidth = 0;

            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2 });
              const offscreenCanvas = document.createElement('canvas');
              const context = offscreenCanvas.getContext('2d');
              offscreenCanvas.height = viewport.height;
              offscreenCanvas.width = viewport.width;
              await page.render({ canvasContext: context!, viewport, canvas: offscreenCanvas }).promise;
              pages.push(offscreenCanvas);
              totalHeight += viewport.height;
              maxWidth = Math.max(maxWidth, viewport.width);
            }

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = maxWidth;
            finalCanvas.height = totalHeight;
            const ctx = finalCanvas.getContext('2d')!;
            let currentY = 0;
            for (const p of pages) {
              ctx.drawImage(p, 0, currentY);
              currentY += p.height;
            }
            imageUrl = finalCanvas.toDataURL();
          }

          const img = await fabric.Image.fromURL(imageUrl, {
            crossOrigin: 'anonymous'
          });

          // Use original dimensions
          const targetWidth = img.width!;
          const targetHeight = img.height!;
          setNativeDimensions({ width: targetWidth, height: targetHeight });

          img.set({
            scaleX: 1,
            scaleY: 1,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
            left: 0,
            top: 0
          });
          
          const dimensions = { 
            width: targetWidth, 
            height: targetHeight
          };
          
          canvas.setDimensions({
            width: targetWidth * zoom,
            height: targetHeight * zoom
          });
          canvas.setZoom(zoom);

          // Set as background image to prevent it being moved or deleted easily
          canvas.set('backgroundImage', img);
          canvas.renderAll();

          // Priority: 1. Student's markup, 2. Teacher's template (from description)
          const dataToLoad = submission?.markupData || (material.description?.trim().startsWith('{') ? material.description : null);
          
          if (dataToLoad) {
            try {
              await canvas.loadFromJSON(dataToLoad);
              
              // Distinguish between loading a template vs loading a student's own work
              const isTemplateLoad = dataToLoad === material.description;

              // After loading JSON, ensure the background image and dimensions are correct
              const zoomedDimensions = {
                width: targetWidth * zoom,
                height: targetHeight * zoom
              };
              canvas.setDimensions(zoomedDimensions);
              canvas.setZoom(zoom);
              if (!canvas.backgroundImage) {
                canvas.set('backgroundImage', img);
              }

              // Lock objects if student
              if (isActuallyStudent) {
                canvas.getObjects().forEach(obj => {
                  // Lock if it's explicitly marked as template OR if we are loading the pure template
                  if ((obj as any).isTemplate || isTemplateLoad) {
                    obj.selectable = false;
                    if (!(obj as any).isHotspot) {
                      obj.evented = false;
                    }
                  }
                });
              }

              canvas.renderAll();
            } catch (e) {
              console.warn("Error loading canvas JSON:", e);
              const zoomedDimensions = {
                width: targetWidth * zoom,
                height: targetHeight * zoom
              };
              canvas.setDimensions(zoomedDimensions);
              canvas.setZoom(zoom);
              canvas.set('backgroundImage', img);
              canvas.renderAll();
            }
          }
        } catch (error) {
          console.error("Error loading background/markup:", error);
        }
      };

      loadBackground();

      setFabricCanvas(canvas);

      canvas.on('selection:created', (e) => {
        const obj = e.selected?.[0];
        if (obj && (obj as any).isHotspot) {
          setSelectedHotspot(obj);
        } else {
          setSelectedHotspot(null);
        }
      });

      canvas.on('selection:updated', (e) => {
        const obj = e.selected?.[0];
        if (obj && (obj as any).isHotspot) {
          setSelectedHotspot(obj);
        } else {
          setSelectedHotspot(null);
        }
      });

      canvas.on('selection:cleared', () => setSelectedHotspot(null));

      canvas.on('mouse:down', (options) => {
        if (options.target && (options.target as any).isHotspot) {
          const hotspot = options.target as any;
          const data = hotspot.hotspotData as HotspotData;
          if (isAdmin && !isPreviewMode) {
            setSelectedHotspot(hotspot);
          } else {
            // Student interaction (or Preview mode) logic
            if (data.type === 'info') {
              setHotspotInfo(data.content);
            } else if (data.type === 'correct' || data.type === 'incorrect') {
              // Visual feedback
              if (data.type === 'correct') {
                hotspot.set('fill', 'rgba(34, 197, 94, 0.6)');
                hotspot.set('stroke', '#22c55e');
              } else {
                hotspot.set('fill', 'rgba(239, 68, 68, 0.6)');
                hotspot.set('stroke', '#ef4444');
              }
              canvas.renderAll();
            } else if (data.type === 'text-response') {
              const response = prompt("Enter your answer:", data.content || "");
              if (response !== null) {
                hotspot.hotspotData = { ...data, content: response };
                hotspot.set('stroke', '#004275');
                hotspot.set('strokeWidth', 3);
                canvas.renderAll();
              }
            }
          }
        }
      });

      return () => {
        canvas.dispose();
      };
    }
  }, [loading, material]);

  const [hotspotInfo, setHotspotInfo] = useState<string | null>(null);

  const handleToolChange = (tool: typeof activeTool) => {
    if (!fabricCanvas) return;
    setActiveTool(tool);
    
    fabricCanvas.isDrawingMode = tool === 'draw';
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();

    if (tool === 'text') {
      const text = new fabric.IText('Double click to type...', {
        left: 100,
        top: 100,
        fontFamily: 'Inter',
        fontSize: 20,
        fill: '#004275'
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      setActiveTool('select');
    } else if (tool === 'rect') {
      const rect = new fabric.Rect({
        left: 150,
        top: 150,
        fill: 'transparent',
        stroke: '#004275',
        strokeWidth: 2,
        width: 100,
        height: 60,
        rx: 10,
        ry: 10
      });
      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
      setActiveTool('select');
    } else if (tool === 'hotspot') {
      const hotspot = new fabric.Rect({
        left: 200,
        top: 200,
        width: 40,
        height: 40,
        fill: 'rgba(0, 66, 117, 0.2)',
        stroke: '#004275',
        strokeWidth: 2,
        rx: 8,
        ry: 8,
        transparentCorners: false,
        cornerColor: '#004275',
        cornerSize: 10,
      });
      // Add custom property for metadata
      (hotspot as any).isHotspot = true;
      (hotspot as any).hotspotData = {
        type: 'info',
        content: 'New Information Point',
        id: Math.random().toString(36).substr(2, 9)
      };
      fabricCanvas.add(hotspot);
      fabricCanvas.setActiveObject(hotspot);
      setSelectedHotspot(hotspot);
      setActiveTool('select');
    } else if (tool === 'check') {
      const check = new fabric.IText('✓', {
        left: 200,
        top: 200,
        fontFamily: 'Inter',
        fontSize: 32,
        fill: '#10b981',
        fontWeight: 'bold'
      });
      fabricCanvas.add(check);
      fabricCanvas.setActiveObject(check);
      setActiveTool('select');
    } else if (tool === 'line') {
      const line = new fabric.Line([50, 50, 200, 50], {
        stroke: '#004275',
        strokeWidth: 3,
        selectable: true
      });
      fabricCanvas.add(line);
      fabricCanvas.setActiveObject(line);
      setActiveTool('select');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const triggerUpload = (type: 'image' | 'pdf' | 'bg') => {
    if (type === 'image') fileInputRef.current?.click();
    if (type === 'pdf') pdfInputRef.current?.click();
    if (type === 'bg') bgInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isBackground = false) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = f.target?.result as string;
      const img = await fabric.Image.fromURL(data, { crossOrigin: 'anonymous' });
      
      if (isBackground) {
        // Use original dimensions
        const targetWidth = img.width!;
        const targetHeight = img.height!;
        setNativeDimensions({ width: targetWidth, height: targetHeight });

        img.set({ 
          scaleX: 1, 
          scaleY: 1, 
          selectable: false, 
          evented: false,
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0
        });
        
        fabricCanvas.setDimensions({ 
          width: targetWidth * zoom, 
          height: targetHeight * zoom
        });
        fabricCanvas.setZoom(zoom);
        fabricCanvas.set('backgroundImage', img);
        
        // Also update Firestore material if teacher
        if (isAdmin && !isPreviewMode) {
          updateDoc(doc(db, 'materials', materialId), { url: data });
        }
      } else {
        img.scaleToWidth(200);
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
      }
      fabricCanvas.renderAll();
    };
    reader.readAsDataURL(file);
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>, isBackground = false) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const data = new Uint8Array(f.target?.result as ArrayBuffer);
      const loadingTask = pdfjs.getDocument({ data });
      const pdf = await loadingTask.promise;
      
      if (isBackground) {
        // Render all pages for background mode
        const pages: HTMLCanvasElement[] = [];
        let totalHeight = 0;
        let maxWidth = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const offscreenCanvas = document.createElement('canvas');
          const context = offscreenCanvas.getContext('2d');
          offscreenCanvas.height = viewport.height;
          offscreenCanvas.width = viewport.width;
          await page.render({ canvasContext: context!, viewport, canvas: offscreenCanvas }).promise;
          pages.push(offscreenCanvas);
          totalHeight += viewport.height;
          maxWidth = Math.max(maxWidth, viewport.width);
        }

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = maxWidth;
        finalCanvas.height = totalHeight;
        const ctx = finalCanvas.getContext('2d')!;
        let currentY = 0;
        for (const p of pages) {
          ctx.drawImage(p, 0, currentY);
          currentY += p.height;
        }
        
        const imageUrl = finalCanvas.toDataURL();
        const img = await fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' });

        // Use original dimensions
        const targetWidth = img.width!;
        const targetHeight = img.height!;
        setNativeDimensions({ width: targetWidth, height: targetHeight });

        img.set({ 
          scaleX: 1, 
          scaleY: 1, 
          selectable: false, 
          evented: false,
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0
        });
        
        fabricCanvas.setDimensions({ 
          width: targetWidth * zoom, 
          height: targetHeight * zoom
        });
        fabricCanvas.setZoom(zoom);
        fabricCanvas.set('backgroundImage', img);
        
        if (isAdmin && !isPreviewMode) {
          updateDoc(doc(db, 'materials', materialId), { url: imageUrl });
        }
      } else {
        // For "Insert PDF", we just use page 1 as an object
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const pdfCanvas = document.createElement('canvas');
        const context = pdfCanvas.getContext('2d');
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        await page.render({ canvasContext: context!, viewport, canvas: pdfCanvas }).promise;
        
        const imageUrl = pdfCanvas.toDataURL();
        const img = await fabric.Image.fromURL(imageUrl, { crossOrigin: 'anonymous' });
        img.scaleToWidth(300);
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
      }
      fabricCanvas.renderAll();
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    if (!fabricCanvas || !auth.currentUser) return;
    setSaving(true);
    try {
      if (isAdmin && !isPreviewMode) {
        // Tag all current objects as template before saving
        fabricCanvas.getObjects().forEach(obj => {
          (obj as any).isTemplate = true;
        });
      }

      const canvasJson = JSON.stringify(fabricCanvas.toObject(['isHotspot', 'hotspotData', 'isTemplate']));
      
      if (isAdmin && !isPreviewMode) {
        // Teacher saves the template
        await updateDoc(doc(db, 'materials', materialId), {
          description: canvasJson,
          timestamp: serverTimestamp()
        });
        alert("Template saved successfully.");
      } else {
        // Student saves their work
        const subId = `${auth.currentUser.uid}_${materialId}`;
        await setDoc(doc(db, 'submissions', subId), {
          materialId,
          uid: auth.currentUser.uid,
          studentName: auth.currentUser.displayName,
          markupData: canvasJson,
          status: 'submitted',
          timestamp: serverTimestamp(),
          submittedAt: serverTimestamp()
        }, { merge: true });
        alert("Worksheet submitted successfully.");
      }
      onClose();
    } catch (error) {
      console.error("Error saving worksheet:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateHotspotType = (type: HotspotData['type']) => {
    if (!selectedHotspot) return;
    const data = (selectedHotspot as any).hotspotData as HotspotData;
    (selectedHotspot as any).hotspotData = { ...data, type };
    
    // Update visual style based on type for teacher view
    let color = 'rgba(0, 66, 117, 0.2)';
    if (type === 'correct') color = 'rgba(34, 197, 94, 0.2)';
    if (type === 'incorrect') color = 'rgba(239, 68, 68, 0.2)';
    if (type === 'text-response') color = 'rgba(249, 115, 22, 0.2)';
    
    selectedHotspot.set('fill', color);
    fabricCanvas?.renderAll();
    setUpdateVersion(v => v + 1);
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#004275] border-t-transparent"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white z-[200] flex">
      {/* Redesigned Sidebar - Now White "Item Panel" */}
      {!isPreviewMode && (
        <aside className="w-[300px] bg-white border-r border-gray-100 flex flex-col shadow-xl h-full overflow-hidden">
          {/* Top Section */}
          <div className="p-6 space-y-4">
            <button 
              onClick={onClose}
              className="w-full bg-[#1e40af] hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <X className="w-3 h-3" /> Close Editor
            </button>

            <div className="bg-[#1d4ed8] rounded-xl p-4 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <div className="w-1 h-1 bg-white rounded-full mb-1" />
                <div className="w-1 h-1 bg-white rounded-full mb-1" />
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 opacity-50" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Lesson</span>
              </div>
              <h2 className="text-sm font-bold truncate">{material?.title || 'Untitled Lesson'}</h2>
              
              <div className="mt-4 flex items-center gap-2">
                <button 
                  onClick={() => {
                    setIsPreviewMode(true);
                    fabricCanvas?.discardActiveObject();
                    fabricCanvas?.renderAll();
                  }}
                  className={`w-8 h-4 rounded-full transition-all relative ${
                    isPreviewMode ? 'bg-green-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isPreviewMode ? 'right-0.5' : 'left-0.5'}`} />
                </button>
                <span className="text-[10px] font-bold opacity-70">Preview Off</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search for a Tool"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Components List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 scrollbar-hide">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Drafting tools</h3>
                <div className="w-4 h-4 rounded bg-gray-50 flex items-center justify-center border border-gray-100">
                   <div className="w-2 h-[1px] bg-gray-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ToolBtnSquare 
                  active={activeTool === 'select'} 
                  onClick={() => handleToolChange('select')} 
                  icon={<MousePointer2 className="w-5 h-5" />} 
                  label="Select" 
                />
                <ToolBtnSquare 
                  active={activeTool === 'hotspot'} 
                  onClick={() => handleToolChange('hotspot')} 
                  icon={<Target className="w-5 h-5" />} 
                  label="Hotspot" 
                  isNew
                />
                <ToolBtnSquare 
                  active={activeTool === 'text'} 
                  onClick={() => handleToolChange('text')} 
                  icon={<Type className="w-5 h-5" />} 
                  label="Text Box" 
                />
                <ToolBtnSquare 
                  active={activeTool === 'rect'} 
                  onClick={() => handleToolChange('rect')} 
                  icon={<Square className="w-5 h-5" />} 
                  label="Drawing" 
                />
                <ToolBtnSquare 
                  active={activeTool === 'check'} 
                  onClick={() => handleToolChange('check')} 
                  icon={<CheckCircle2 className="w-5 h-5" />} 
                  label="Checkmark" 
                />
                <ToolBtnSquare 
                  active={activeTool === 'line'} 
                  onClick={() => handleToolChange('line')} 
                  icon={<ArrowLeft className="w-5 h-5 rotate-180" />} 
                  label="Connector" 
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Media Assets</h3>
                <div className="w-4 h-4 rounded bg-gray-50 flex items-center justify-center border border-gray-100">
                   <div className="w-2 h-[1px] bg-gray-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ToolBtnSquare 
                  active={false} 
                  onClick={() => triggerUpload('image')} 
                  icon={<ImagePlus className="w-5 h-5" />} 
                  label="Add Image" 
                />
                <ToolBtnSquare 
                  active={false} 
                  onClick={() => triggerUpload('pdf')} 
                  icon={<FileUp className="w-5 h-5" />} 
                  label="Insert PDF" 
                />
                {isAdmin && (
                  <ToolBtnSquare 
                    active={false} 
                    onClick={() => triggerUpload('bg')} 
                    icon={<Files className="w-5 h-5" />} 
                    label="Swap Base" 
                  />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Quick Actions</h3>
                <div className="w-4 h-4 rounded bg-gray-50 flex items-center justify-center border border-gray-100">
                   <div className="w-2 h-[1px] bg-gray-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleSave}
                  className="bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50 p-4 rounded-xl flex flex-col items-center justify-center gap-2 group transition-all"
                >
                  <Save className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600">{saving ? 'Saving...' : 'Save All'}</span>
                </button>
                <button 
                  onClick={() => fabricCanvas?.remove(...fabricCanvas.getActiveObjects())}
                  className="bg-white border border-gray-100 hover:border-red-200 hover:bg-red-50 p-4 rounded-xl flex flex-col items-center justify-center gap-2 group transition-all"
                >
                  <Trash2 className="w-5 h-5 text-gray-300 group-hover:text-red-500" />
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-red-600">Delete Item</span>
                </button>
              </div>
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleImageUpload(e, false)}
          />
          <input 
            type="file" 
            ref={pdfInputRef} 
            className="hidden" 
            accept=".pdf"
            onChange={(e) => handlePDFUpload(e, false)}
          />
          <input 
            type="file" 
            ref={bgInputRef} 
            className="hidden" 
            accept="image/*,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.type.includes('pdf')) {
                handlePDFUpload(e, true);
              } else {
                handleImageUpload(e, true);
              }
            }}
          />

          <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-black">
                P
              </div>
              <span className="text-[10px] font-bold text-gray-600">Chat</span>
            </div>
            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
              1
            </div>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar like variant bar in image */}
        <div className="h-14 bg-gray-50 border-b border-gray-100 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Variant</span>
             <button className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-100 rounded-md shadow-sm">
                <Zap className="w-3 h-3 text-blue-500 fill-blue-500" />
                <span className="text-xs font-bold text-gray-600 uppercase">Default</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
             </button>

             <div className="h-4 w-[1px] bg-gray-200" />

             {/* Zoom Controls */}
             <div className="flex items-center bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm mr-2">
                <button 
                  onClick={() => handleZoom(zoom - 0.1)}
                  title="Zoom Out"
                  className="p-1.5 px-3 hover:bg-gray-50 border-r border-gray-100 text-gray-500 transition-colors"
                >
                  -
                </button>
                <span className="px-3 text-[10px] font-black text-gray-600 tabular-nums min-w-[50px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button 
                  onClick={() => handleZoom(zoom + 0.1)}
                  title="Zoom In"
                  className="p-1.5 px-3 hover:bg-gray-50 border-l border-gray-100 text-gray-500 transition-colors"
                >
                  +
                </button>
             </div>

             <button 
                onClick={() => handleZoom(1)}
                className="px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-colors shadow-sm mr-2"
              >
                Reset
              </button>

              <button 
                onClick={() => {
                  const mainWidth = document.querySelector('main')?.clientWidth || 1000;
                  const newZoom = (mainWidth - 80) / nativeDimensions.width;
                  handleZoom(newZoom);
                }}
                className="px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-colors shadow-sm"
              >
                Fit Width
              </button>

          </div>

          <div className="flex items-center gap-4">
             {isPreviewMode && (
               <button 
                onClick={() => setIsPreviewMode(false)}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
               >
                 Close Preview
               </button>
             )}
             <div className="flex items-center gap-2 text-gray-300 italic text-[10px] font-medium">
                <CheckCircle2 className="w-3 h-3" />
                All Changes Saved
             </div>
             <div className="flex items-center gap-2 ml-4">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-white">
                   <Zap className="w-3 h-3" />
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                   ?
                </div>
             </div>
          </div>
        </div>

        {/* Selected Hotspot Controls (Teacher Only) */}
        {isAdmin && selectedHotspot && !isPreviewMode && (
          <div className="bg-white border-b border-gray-100 p-6 transition-all shadow-sm">
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                key={`config-${(selectedHotspot as any).hotspotData.id}-${updateVersion}`}
                className="w-full max-w-6xl mx-auto flex items-center justify-between gap-8"
              >
                <div className="flex items-center gap-8 flex-1">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[#004275] mb-3">Item Configuration</h3>
                    <div className="flex gap-2">
                      <ConfigBadge 
                        active={(selectedHotspot as any).hotspotData.type === 'correct'}
                        onClick={() => updateHotspotType('correct')}
                        color="bg-green-600"
                        label="Correct"
                        icon={<CheckCircle2 className="w-3 h-3" />}
                      />
                      <ConfigBadge 
                        active={(selectedHotspot as any).hotspotData.type === 'incorrect'}
                        onClick={() => updateHotspotType('incorrect')}
                        color="bg-red-600"
                        label="Incorrect"
                        icon={<AlertCircle className="w-3 h-3" />}
                      />
                      <ConfigBadge 
                        active={(selectedHotspot as any).hotspotData.type === 'info'}
                        onClick={() => updateHotspotType('info')}
                        color="bg-blue-600"
                        label="Info"
                        icon={<Info className="w-3 h-3" />}
                      />
                      <ConfigBadge 
                        active={(selectedHotspot as any).hotspotData.type === 'text-response'}
                        onClick={() => updateHotspotType('text-response')}
                        color="bg-orange-600"
                        label="Response"
                        icon={<Type className="w-3 h-3" />}
                      />
                    </div>
                  </div>
                  <div className="h-12 w-[1px] bg-gray-100" />
                  <div className="flex-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[#004275] mb-3">Content / Instructions</h3>
                    <input 
                      type="text" 
                      value={(selectedHotspot as any).hotspotData.content || ''}
                      onChange={(e) => {
                        const data = (selectedHotspot as any).hotspotData;
                        (selectedHotspot as any).hotspotData = { ...data, content: e.target.value };
                        fabricCanvas?.renderAll();
                        setUpdateVersion(v => v + 1);
                      }}
                      placeholder="Enter hotspot text, feedback, or instructions..."
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-gray-300 shadow-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                    onClick={() => {
                        fabricCanvas?.remove(selectedHotspot);
                        setSelectedHotspot(null);
                    }}
                    className="flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 font-bold text-xs uppercase tracking-widest"
                   >
                     <Trash2 className="w-4 h-4" />
                     Delete
                   </button>
                </div>
              </motion.div>
          </div>
        )}

        {/* Canvas Area */}
        <main className="flex-1 overflow-auto p-8 sm:p-12 lg:p-16 flex flex-col items-center bg-[#f8fafc] scroll-smooth">
          <div className="shadow-2xl rounded-2xl overflow-hidden h-fit bg-white border border-gray-100 mb-20 group relative transition-all duration-300 transform-gpu">
            <canvas ref={canvasRef} />
            
            {/* If no content / placeholder look from image */}
            {isPreviewMode && !submission?.markupData && !material?.description && (
              <div className="absolute inset-0 bg-gray-50/50 backdrop-blur-sm flex items-center justify-center pointer-events-none p-10">
                 <div className="max-w-md bg-white p-12 rounded-[32px] text-center shadow-2xl border border-gray-100 z-10">
                    <div className="w-20 h-20 bg-gray-50 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                       <Target className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-2">No Content Preview</h3>
                    <p className="text-gray-500 text-xs font-medium leading-relaxed mb-6">
                      You haven't placed any interactive elements yet. Switch back to editor mode to start building your assignment.
                    </p>
                    <button 
                      onClick={() => setIsPreviewMode(false)}
                      className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-200"
                    >
                      Return to Editor
                    </button>
                 </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {hotspotInfo && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed bottom-12 right-12 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 z-50 overflow-hidden"
              >
                 <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
                 <button 
                  onClick={() => setHotspotInfo(null)}
                  className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full text-gray-400"
                 >
                   <X className="w-4 h-4" />
                 </button>
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                   <Target className="w-3 h-3" /> Area Information
                 </h4>
                 <div className="prose prose-sm text-gray-600 font-medium leading-relaxed">
                   {hotspotInfo}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function ToolBtnSquare({ active, onClick, icon, label, isNew }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isNew?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all relative group border shadow-sm ${
        active 
          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' 
          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      {isNew && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-blue-600 rounded text-[6px] font-black text-white uppercase tracking-tighter shadow-md">New</span>
      )}
      <div className={`transition-all duration-300 ${active ? 'text-blue-600 scale-110' : 'text-gray-400 group-hover:text-blue-500'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold transition-all duration-300 ${active ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-600'}`}>
        {label}
      </span>
    </button>
  );
}

function ConfigBadge({ active, onClick, color, label, icon }: { active: boolean, onClick: () => void, color: string, label: string, icon: React.ReactNode }) {
  // Use color for indicator only, keep badge white
  const isActive = active;
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-2 shadow-sm ${
        isActive 
          ? `bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50` 
          : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? color : 'bg-gray-200'}`} />
      {icon} {label}
    </button>
  );
}
