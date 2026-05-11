import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { motion, AnimatePresence } from 'motion/react';
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
  MousePointer2,
  Download,
  CheckCircle2,
  Loader2,
  Trash2
} from 'lucide-react';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Material, Submission } from '../types';

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
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'rect' | 'circle' | 'draw' | 'hotspot' | 'check' | 'line'>('select');
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadData();
  }, [materialId]);

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
        width: 800,
        height: 1000,
        backgroundColor: '#fff',
      });

      // Load background image
      if (material.url) {
        fabric.Image.fromURL(material.url, {
          crossOrigin: 'anonymous'
        }).then((img) => {
          const scale = 800 / img.width!;
          img.set({
            scaleX: scale,
            scaleY: scale,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top'
          });
          canvas.add(img);
          
          canvas.setDimensions({ 
            width: canvas.width!, 
            height: (img.height || 0) * scale 
          });

          // Priority: 1. Student's markup, 2. Teacher's template (from description)
          if (submission?.markupData) {
            canvas.loadFromJSON(submission.markupData).then(() => {
              canvas.renderAll();
            });
          } else if (material.description && material.description.trim().startsWith('{')) {
             try {
                canvas.loadFromJSON(material.description).then(() => canvas.renderAll());
             } catch(e) {
               console.warn("Valid JSON template not found in material description");
             }
          }
        });
      }

      setFabricCanvas(canvas);

      canvas.on('mouse:down', (options) => {
        if (options.target && (options.target as any).isHotspot) {
          const hotspot = options.target as any;
          const data = hotspot.hotspotData;
          if (isAdmin) {
            const newContent = prompt("Edit Information Panel Content:", data.content);
            if (newContent !== null) {
              hotspot.hotspotData = { ...data, content: newContent };
              // Maybe update the inner label if we had one
            }
          } else {
            // Student sees info
            setHotspotInfo(data.content);
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
      const hotspot = new fabric.Circle({
        left: 200,
        top: 200,
        radius: 15,
        fill: '#004275',
        opacity: 0.6,
        stroke: '#fff',
        strokeWidth: 2,
        hasControls: true,
        hasBorders: true,
      });
      // Add custom property for metadata
      (hotspot as any).isHotspot = true;
      (hotspot as any).hotspotData = {
        type: 'info',
        content: 'Edit this hotspot info...'
      };
      fabricCanvas.add(hotspot);
      fabricCanvas.setActiveObject(hotspot);
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

  const handleSave = async () => {
    if (!fabricCanvas || !auth.currentUser) return;
    setSaving(true);
    try {
      const canvasJson = JSON.stringify(fabricCanvas.toJSON());
      
      if (isAdmin) {
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

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#004275] border-t-transparent"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#f0f2f5] z-[200] flex flex-col">
      {/* Workspace Header */}
      <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#004275] font-headline">{material?.title}</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Interactive Worksheet Mode • {isAdmin ? 'Teaching Template' : 'Student Submission'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            disabled={saving}
            onClick={handleSave}
            className="bg-[#004275] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#005a9c] transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {isAdmin ? 'Save Template' : 'Submit Work'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar */}
        <aside className="w-20 bg-white border-r border-gray-100 flex flex-col items-center py-6 gap-6 shadow-xl">
          <ToolBtn 
            active={activeTool === 'select'} 
            onClick={() => handleToolChange('select')} 
            icon={<MousePointer2 className="w-6 h-6" />} 
            label="Select" 
          />
          <ToolBtn 
            active={activeTool === 'draw'} 
            onClick={() => handleToolChange('draw')} 
            icon={<Eraser className="w-6 h-6 rotate-180" />} 
            label="Draw" 
          />
          <ToolBtn 
            active={activeTool === 'text'} 
            onClick={() => handleToolChange('text')} 
            icon={<Type className="w-6 h-6" />} 
            label="Text" 
          />
          <ToolBtn 
            active={activeTool === 'rect'} 
            onClick={() => handleToolChange('rect')} 
            icon={<Square className="w-6 h-6" />} 
            label="Shape" 
          />
          <ToolBtn 
            active={activeTool === 'hotspot'} 
            onClick={() => handleToolChange('hotspot')} 
            icon={<Target className="w-6 h-6" />} 
            label="Hotspot" 
          />
          <ToolBtn 
            active={activeTool === 'check'} 
            onClick={() => handleToolChange('check')} 
            icon={<CheckCircle2 className="w-6 h-6" />} 
            label="Checkmark" 
          />
          <ToolBtn 
            active={activeTool === 'line'} 
            onClick={() => handleToolChange('line')} 
            icon={<ArrowLeft className="w-6 h-6 rotate-180" />} 
            label="Connector" 
          />
          
          <div className="mt-auto flex flex-col gap-4">
            <button 
              onClick={() => fabricCanvas?.remove(...fabricCanvas.getActiveObjects())}
              className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button 
              onClick={() => {
                const dataUrl = fabricCanvas?.toDataURL();
                if (dataUrl) {
                  const link = document.createElement('a');
                  link.download = `worksheet-${Date.now()}.png`;
                  link.href = dataUrl;
                  link.click();
                }
              }}
              className="p-3 text-gray-400 hover:text-[#004275] hover:bg-blue-50 rounded-2xl transition-all"
            >
              <Download className="w-6 h-6" />
            </button>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 overflow-auto p-12 flex justify-center bg-gray-100/50">
          <div className="shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-lg overflow-hidden h-fit bg-white border border-gray-200">
            <canvas ref={canvasRef} />
          </div>

          <AnimatePresence>
            {hotspotInfo && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed bottom-12 right-12 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 z-50 overflow-hidden"
              >
                 <div className="absolute top-0 left-0 w-full h-2 bg-[#004275]" />
                 <button 
                  onClick={() => setHotspotInfo(null)}
                  className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full text-gray-400"
                 >
                   <X className="w-4 h-4" />
                 </button>
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-[#004275] mb-4 flex items-center gap-2">
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

function ToolBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`group relative flex flex-col items-center p-3 rounded-2xl transition-all ${
        active 
          ? 'bg-[#004275] text-white shadow-lg scale-110' 
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
      }`}
    >
      {icon}
      <span className={`absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none`}>
        {label}
      </span>
    </button>
  );
}
