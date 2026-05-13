import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
const PDFJS_VERSION = '5.7.284';
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
import { detectAnswerChoices, generateQuizItems, QuizQuestion } from '../services/geminiService';
import { 
  Square, 
  Circle, 
  Type, 
  Pencil,
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
  Files,
  Wand2,
  Sparkles
} from 'lucide-react';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useDialog } from '../context/DialogContext';
import { Material, Submission, HotspotData } from '../types';

interface InteractiveWorksheetProps {
  materialId: string;
  courseId: string;
  userRole?: string;
  onClose: () => void;
}

export function InteractiveWorksheet({ materialId, courseId, userRole, onClose }: InteractiveWorksheetProps) {
  const { showAlert, showConfirm } = useDialog();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'rect' | 'circle' | 'draw' | 'eraser' | 'hotspot' | 'check' | 'line'>('select');
  const [selectedHotspot, setSelectedHotspot] = useState<fabric.Object | null>(null);
  const [updateVersion, setUpdateVersion] = useState(0);
  const isAdmin = userRole === 'admin';
  const isActuallyStudent = !isAdmin || isPreviewMode;

  const [zoom, setZoom] = useState(1);
  const [nativeDimensions, setNativeDimensions] = useState({ width: 1000, height: 1000 });
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCumulativeHeights, setPageCumulativeHeights] = useState<number[]>([]);
  const mainRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoom = (level: number) => {
    if (!fabricCanvas) return;
    const newZoom = Math.min(Math.max(level, 0.1), 3);
    
    // Zoom to center of viewport
    const center = fabricCanvas.getVpCenter();
    fabricCanvas.zoomToPoint(new fabric.Point(center.x, center.y), newZoom);
    setZoom(newZoom);
  };

  const loadData = async () => {
    console.log("InteractiveWorksheet: loadData starting");
    if (!material) setLoading(true);
    try {
      const matDoc = await getDoc(doc(db, 'materials', materialId));
      if (matDoc.exists()) {
        const matData = { id: matDoc.id, ...matDoc.data() } as Material;
        setMaterial(matData);
        console.log("InteractiveWorksheet: Material loaded", matData.title);

        // If student, check for existing submission
        if (auth.currentUser && !isAdmin) {
          const subId = `${auth.currentUser.uid}_${materialId}`;
          const subDoc = await getDoc(doc(db, 'submissions', subId));
          if (subDoc.exists()) {
            setSubmission({ id: subDoc.id, ...subDoc.data() } as Submission);
            console.log("InteractiveWorksheet: Submission loaded");
          }
        }
      } else {
        console.warn("InteractiveWorksheet: Material not found", materialId);
      }
    } catch (error) {
      console.error("Error loading worksheet data:", error);
    } finally {
      console.log("InteractiveWorksheet: loadData finished");
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      loadData();
    }
    return () => { mounted = false; };
  }, [materialId, auth.currentUser?.uid]);

  const isInitializing = useRef(false);

  useEffect(() => {
    if (loading || !canvasRef.current || !material || !containerRef.current || isInitializing.current || fabricCanvas) return;
    
    isInitializing.current = true;
    console.log("InteractiveWorksheet: Initializing Canvas");
    const container = containerRef.current;
    
    try {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: '#f1f5f9',
        preserveObjectStacking: true,
      });

      setFabricCanvas(canvas);

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
            const PAGE_GAP_PX = 40; // Spacing between pages in the combined image
            const cumulativeHeights: number[] = [];

            setNumPages(pdf.numPages);

            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2 });
              const offscreenCanvas = document.createElement('canvas');
              const context = offscreenCanvas.getContext('2d');
              offscreenCanvas.height = viewport.height;
              offscreenCanvas.width = viewport.width;
              await page.render({ canvasContext: context!, viewport, canvas: offscreenCanvas }).promise;
              pages.push(offscreenCanvas);
              
              cumulativeHeights.push(totalHeight);
              totalHeight += viewport.height + (i < pdf.numPages ? PAGE_GAP_PX : 0);
              maxWidth = Math.max(maxWidth, viewport.width);
            }
            setPageCumulativeHeights(cumulativeHeights);

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = maxWidth;
            finalCanvas.height = totalHeight;
            const ctx = finalCanvas.getContext('2d')!;
            
            // Fill background with light gray to create "page gaps"
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(0, 0, maxWidth, totalHeight);

            let currentY = 0;
            for (const p of pages) {
              // Center pages if they have different widths
              const xOffset = (maxWidth - p.width) / 2;
              
              // Draw "page shadow" for the individual page
              ctx.shadowColor = 'rgba(0,0,0,0.1)';
              ctx.shadowBlur = 20;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 4;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(xOffset, currentY, p.width, p.height);
              
              // Draw the actual page
              ctx.shadowBlur = 0;
              ctx.drawImage(p, xOffset, currentY);
              currentY += p.height + PAGE_GAP_PX;
            }
            imageUrl = finalCanvas.toDataURL('image/jpeg', 0.85);
          }

          const img = await fabric.Image.fromURL(imageUrl, {
            crossOrigin: 'anonymous'
          });

          // Store native dimensions
          const targetWidth = img.width!;
          const targetHeight = img.height!;
          setNativeDimensions({ width: targetWidth, height: targetHeight });

          img.set({
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
            left: 0,
            top: 0
          });
          
          // Set as background image
          canvas.set('backgroundImage', img);

          // Initial centering and fit
          const initialZoom = (container.clientWidth - 100) / targetWidth;
          canvas.setZoom(Math.min(initialZoom, 1));
          setZoom(Math.min(initialZoom, 1));
          
          // Center the content initially
          const vpt = canvas.viewportTransform!;
          vpt[4] = (canvas.getWidth() - targetWidth * canvas.getZoom()) / 2;
          vpt[5] = 50; // top padding
          canvas.requestRenderAll();

          // Priority: 1. Student's markup, 2. Teacher's template (from description)
          const dataToLoad = submission?.markupData || (material.description?.trim().startsWith('{') ? material.description : null);
          
          if (dataToLoad) {
            try {
              await canvas.loadFromJSON(dataToLoad);
              const isTemplateLoad = dataToLoad === material.description;

              if (!canvas.backgroundImage) {
                canvas.set('backgroundImage', img);
              }

              // Lock objects if student
              if (isActuallyStudent) {
                canvas.getObjects().forEach(obj => {
                  if ((obj as any).isTemplate || isTemplateLoad) {
                    obj.selectable = false;
                    obj.evented = (obj as any).isHotspot; // Only hotspots remain reactive
                  }
                });
              }
              canvas.requestRenderAll();
            } catch (e) {
              console.warn("Error loading canvas JSON:", e);
              canvas.set('backgroundImage', img);
              canvas.renderAll();
            }
          }
        } catch (error) {
          console.error("Error loading background/markup:", error);
        }
      };

      loadBackground();
      
      // Infinite Canvas Panning & Scrolling Logic
      canvas.on('mouse:wheel', function(opt) {
        var delta = opt.e.deltaY;
        var zoom = canvas.getZoom();
        
        if (opt.e.ctrlKey) {
          // Zoom
          zoom *= 0.999 ** delta;
          if (zoom > 3) zoom = 3;
          if (zoom < 0.1) zoom = 0.1;
          canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
          setZoom(zoom);
        } else {
          // Pan Vertical
          var vpt = this.viewportTransform!;
          vpt[5] -= delta;
          
          // Constrain vertical panning
          const bgHeight = (canvas.backgroundImage as fabric.Image)?.height || 0;
          const zoomedHeight = bgHeight * zoom;
          const minPan = canvas.getHeight() - zoomedHeight - 100;
          if (vpt[5] > 100) vpt[5] = 100;
          if (vpt[5] < minPan) vpt[5] = minPan;
        }
        opt.e.preventDefault();
        opt.e.stopPropagation();
        canvas.requestRenderAll();
        
        // Update current page based on scroll
        if (pageCumulativeHeights.length > 0) {
          const vpt = canvas.viewportTransform!;
          const currentY = -vpt[5] / zoom;
          let newPage = 1;
          for (let i = pageCumulativeHeights.length - 1; i >= 0; i--) {
            if (currentY >= pageCumulativeHeights[i]) {
              newPage = i + 1;
              break;
            }
          }
          setCurrentPage(newPage);
        }
      });

      canvas.on('mouse:down', function(opt) {
        var evt = opt.e as MouseEvent;
        if (evt.altKey === true || activeTool === 'select' && !opt.target) {
          (this as any).isDragging = true;
          this.selection = false;
          (this as any).lastPosX = evt.clientX;
          (this as any).lastPosY = evt.clientY;
        }
      });

      canvas.on('mouse:move', function(opt) {
        if ((this as any).isDragging) {
          var e = opt.e as MouseEvent;
          var vpt = this.viewportTransform!;
          vpt[4] += e.clientX - (this as any).lastPosX;
          vpt[5] += e.clientY - (this as any).lastPosY;
          
          // Constrain horizontal panning to keep some of the PDF visible
          const bgWidth = (canvas.backgroundImage as fabric.Image)?.width || 0;
          const zoomedWidth = bgWidth * canvas.getZoom();
          const maxLeft = canvas.getWidth() - 100;
          const minLeft = -zoomedWidth + 100;
          if (vpt[4] > maxLeft) vpt[4] = maxLeft;
          if (vpt[4] < minLeft) vpt[4] = minLeft;

          this.requestRenderAll();
          (this as any).lastPosX = e.clientX;
          (this as any).lastPosY = e.clientY;
        }
      });

      canvas.on('mouse:up', function(opt) {
        this.setViewportTransform(this.viewportTransform!);
        (this as any).isDragging = false;
        this.selection = true;
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        canvas.setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      });
      resizeObserver.observe(container);

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
              const rect = hotspot.item ? hotspot.item(0) : hotspot;
              if (data.type === 'correct') {
                rect.set('fill', 'rgba(34, 197, 94, 0.6)');
                rect.set('stroke', '#22c55e');
              } else {
                rect.set('fill', 'rgba(239, 68, 68, 0.6)');
                rect.set('stroke', '#ef4444');
              }
              canvas.renderAll();
            } else if (data.type === 'text-response') {
              const response = prompt("Enter your answer:", data.content === 'Double click to type...' ? '' : data.content);
              if (response !== null) {
                hotspot.hotspotData = { ...data, content: response };
                updateHotspotVisuals(hotspot);
              }
            }
          }
        }
      });

      return () => {
        canvas.dispose();
        isInitializing.current = false;
        setFabricCanvas(null);
      };
    } catch (error) {
      console.error("InteractiveWorksheet: Error initializing canvas", error);
      isInitializing.current = false;
    }
  }, [loading, material]);

  const updateHotspotVisuals = (hotspot: any) => {
    if (!hotspot || !hotspot.isHotspot) return;
    const data = hotspot.hotspotData as HotspotData;
    
    let fill = 'rgba(0, 66, 117, 0.2)';
    let stroke = '#004275';
    if (data.type === 'correct') { fill = 'rgba(34, 197, 94, 0.3)'; stroke = '#16a34a'; }
    if (data.type === 'incorrect') { fill = 'rgba(239, 68, 68, 0.3)'; stroke = '#dc2626'; }
    if (data.type === 'text-response') { fill = 'rgba(59, 130, 246, 0.15)'; stroke = '#3b82f6'; }
    
    if (hotspot instanceof fabric.Group) {
      const rect = hotspot.item(0) as fabric.Rect;
      const label = hotspot.item(1) as fabric.IText;
      if (rect) rect.set({ fill, stroke });
      if (label) {
        label.set({ 
          text: data.content || '', 
          fill: stroke,
          fontSize: Math.min(rect.width! * rect.scaleX! * 0.8, rect.height! * rect.scaleY! * 0.8, 14)
        });
      }
    } else {
      hotspot.set({ fill, stroke });
    }
    
    fabricCanvas?.renderAll();
  };

  const quickAddHotspot = () => {
    if (!fabricCanvas || isActuallyStudent) return;
    
    // Use chronologically last hotspot from the object stack
    const hotspots = fabricCanvas.getObjects().filter(obj => (obj as any).isHotspot);
    const center = fabricCanvas.getVpCenter();
    
    let left = center.x - 20;
    let top = center.y - 20;
    let lastType: HotspotData['type'] = 'info';

    if (hotspots.length > 0) {
      // Find the chronologically last hotspot added (last in the array)
      const lastHotspot = hotspots[hotspots.length - 1];
      
      // Place it directly under the last one
      left = lastHotspot.left!;
      top = lastHotspot.top! + (lastHotspot.height! * lastHotspot.scaleY!) + 20; // Slightly smaller gap
      lastType = (lastHotspot as any).hotspotData?.type || 'info';
    }

    // Determine colors based on type
    let fill = 'rgba(0, 66, 117, 0.2)';
    let stroke = '#004275';
    if (lastType === 'correct') { fill = 'rgba(34, 197, 94, 0.2)'; stroke = '#16a34a'; }
    if (lastType === 'incorrect') { fill = 'rgba(239, 68, 68, 0.2)'; stroke = '#dc2626'; }
    if (lastType === 'text-response') { fill = 'rgba(249, 115, 22, 0.2)'; stroke = '#ea580c'; }

    const rect = new fabric.Rect({
      width: 40,
      height: 40,
      fill,
      stroke,
      strokeWidth: 2,
      rx: 8,
      ry: 8,
      originX: 'center',
      originY: 'center'
    });

    const label = new fabric.IText('', {
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fill: stroke,
      originX: 'center',
      originY: 'center'
    });

    const hotspot = new fabric.Group([rect, label], {
      left,
      top,
      transparentCorners: false,
      cornerColor: stroke,
      cornerSize: 10,
    });
    
    (hotspot as any).isHotspot = true;
    (hotspot as any).hotspotData = {
      type: lastType,
      content: lastType === 'info' ? 'New Information Point' : 'New Interaction',
      id: Math.random().toString(36).substr(2, 9)
    };
    
    fabricCanvas.add(hotspot);
    fabricCanvas.setActiveObject(hotspot);
    setSelectedHotspot(hotspot);
    fabricCanvas.requestRenderAll();
    updateHotspotVisuals(hotspot);

    // Scroll viewport if new hotspot is out of view
    const vpt = fabricCanvas.viewportTransform!;
    const zoom = fabricCanvas.getZoom();
    const zoomedTop = top * zoom + vpt[5];
    const canvasHeight = fabricCanvas.getHeight();

    if (zoomedTop > canvasHeight - 100) {
      vpt[5] -= (zoomedTop - (canvasHeight / 2));
      fabricCanvas.requestRenderAll();
    }
  };

  const handleClearDetections = async () => {
    if (!fabricCanvas || isActuallyStudent) return;
    if (await showConfirm("Clear all detected markers and hotspots?", "Clear Worksheet")) {
      const hotspots = fabricCanvas.getObjects().filter(obj => (obj as any).isHotspot);
      fabricCanvas.remove(...hotspots);
      setSelectedHotspot(null);
      fabricCanvas.renderAll();
    }
  };

  const handleDetectAnswers = async () => {
    if (!fabricCanvas || isDetecting) return;
    
    // Check if an area is selected to use as target
    const activeObject = fabricCanvas.getActiveObject();
    let cropRect: { left: number, top: number, width: number, height: number } | null = null;
    
    if (activeObject && activeObject.type === 'rect') {
      cropRect = {
        left: activeObject.left!,
        top: activeObject.top!,
        width: activeObject.width! * activeObject.scaleX!,
        height: activeObject.height! * activeObject.scaleY!
      };
    }

    setIsDetecting(true);
    try {
      // Temporarily hide objects to capture background only
      const objects = fabricCanvas.getObjects();
      objects.forEach(obj => obj.visible = false);
      
      // If we have a crop rect, temporarily show it so we can see what we're detecting if we wanted, 
      // but usually we want to hide it to see the text underneath
      fabricCanvas.renderAll();

      let dataUrl: string;
      if (cropRect) {
        // Capture only the cropped area
        dataUrl = fabricCanvas.toDataURL({
          format: 'png',
          left: cropRect.left,
          top: cropRect.top,
          width: cropRect.width,
          height: cropRect.height,
          multiplier: 1 / fabricCanvas.getZoom()
        });
      } else {
        dataUrl = fabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1 / fabricCanvas.getZoom()
        });
      }

      // Restore objects
      objects.forEach(obj => obj.visible = true);
      fabricCanvas.renderAll();

      const detections = await detectAnswerChoices(dataUrl);
      
      detections.forEach(det => {
        let left: number, top: number, width: number, height: number;
        
        if (cropRect) {
          // Map local crop coordinates back to global canvas coordinates
          left = cropRect.left + (det.x * cropRect.width);
          top = cropRect.top + (det.y * cropRect.height);
          width = det.width * cropRect.width;
          height = det.height * cropRect.height;
        } else {
          left = det.x * nativeDimensions.width;
          top = det.y * nativeDimensions.height;
          width = det.width * nativeDimensions.width;
          height = det.height * nativeDimensions.height;
        }
        
        // Calculate type first to use in size logic
        const finalType = det.type === 'text-response' ? 'text-response' : (det.isCorrect ? 'correct' : 'incorrect');
        
        // Ensure minimum size for interaction
        width = Math.max(width, 30);
        height = Math.max(height, 30);
        
        // Guardrails: prevent answer choice markers from being huge
        if (finalType !== 'text-response') {
          width = Math.min(width, 100);
          height = Math.min(height, 100);
        } else {
          // Even for text fields, cap the height to prevent vertical bars
          height = Math.min(height, 80); 
        }

        let type = finalType as HotspotData['type'];
        let fill = 'rgba(0, 66, 117, 0.2)';
        let stroke = '#004275';

        if (finalType === 'text-response') {
          fill = 'rgba(59, 130, 246, 0.15)'; 
          stroke = '#3b82f6';
        } else if (finalType === 'correct') {
          fill = 'rgba(34, 197, 94, 0.3)';
          stroke = '#16a34a';
        } else {
          fill = 'rgba(239, 68, 68, 0.3)';
          stroke = '#dc2626';
        }

        const rect = new fabric.Rect({
          width: width,
          height: height,
          fill,
          stroke,
          strokeWidth: 2,
          rx: 6,
          ry: 6,
          originX: 'center',
          originY: 'center'
        });

        const label = new fabric.IText(det.label || '', {
          fontSize: Math.min(width, height, 14),
          fontFamily: 'Inter',
          fontWeight: 'bold',
          fill: stroke,
          originX: 'center',
          originY: 'center'
        });

        const hotspot = new fabric.Group([rect, label], {
          left: left - (width / 2),
          top: top - (height / 2),
          transparentCorners: false,
          cornerColor: stroke,
          cornerSize: 8,
          selectable: !isActuallyStudent,
        });

        (hotspot as any).isHotspot = true;
        (hotspot as any).hotspotData = {
          type,
          content: det.label || (type === 'text-response' ? 'Double click to type...' : ''),
          id: Math.random().toString(36).substr(2, 9)
        };

        fabricCanvas.add(hotspot);
      });

      fabricCanvas.requestRenderAll();
      
      if (cropRect) {
        // Delete the selection box used for detection
        fabricCanvas.remove(activeObject!);
        fabricCanvas.discardActiveObject();
      }

      await showAlert(`AI detected ${detections.length} total markers.`, "AI Detection Complete");
    } catch (error) {
      console.error("AI Detection Error:", error);
      await showAlert("AI Detection failed. Try selecting a smaller area or check your connection.", "Detection Failed");
    } finally {
      setIsDetecting(false);
    }
  };

  const [quizParams, setQuizParams] = useState({
    numQuestions: 5,
    numOptions: 4,
    type: 'multiple-choice' as 'multiple-choice' | 'true-false' | 'text'
  });

  const handleGenerateQuizAI = async () => {
    if (!fabricCanvas || isGeneratingQuiz) return;
    setIsGeneratingQuiz(true);
    try {
      const quizItems = await generateQuizItems(
        material?.title || "Worksheet",
        quizParams.numQuestions,
        quizParams.numOptions,
        quizParams.type
      );

      // Place quiz items in a vertical column starting from viewport center or below last hotspot
      const hotspots = fabricCanvas.getObjects().filter(obj => (obj as any).isHotspot);
      const center = fabricCanvas.getVpCenter();
      
      let startLeft = center.x - 100;
      let startTop = center.y - 100;

      if (hotspots.length > 0) {
        const lastHotspot = hotspots[hotspots.length - 1];
        startTop = lastHotspot.top! + 100;
        startLeft = lastHotspot.left!;
      }

      quizItems.forEach((q, qIndex) => {
        const qY = startTop + (qIndex * 250);
        // Create question text
        const qText = new fabric.IText(`Q${qIndex + 1}: ${q.question}`, {
          left: startLeft,
          top: qY,
          fontSize: 18,
          fontFamily: 'Inter',
          fontWeight: 'bold',
          fill: '#0f172a',
          width: 300
        });
        fabricCanvas.add(qText);

        // If it's a text question, add one text-response hotspot
        if (quizParams.type === 'text') {
           const hotspot = new fabric.Rect({
            left: startLeft,
            top: qY + 40,
            width: 200,
            height: 40,
            fill: 'rgba(249, 115, 22, 0.2)',
            stroke: '#ea580c',
            strokeWidth: 2,
            rx: 6,
            ry: 6,
            cornerColor: '#ea580c',
            cornerSize: 8,
          });

          (hotspot as any).isHotspot = true;
          (hotspot as any).hotspotData = {
            type: 'text-response',
            content: 'Write answer here',
            id: Math.random().toString(36).substr(2, 9)
          };
          fabricCanvas.add(hotspot);
        } else {
          // Create options as hotspots
          q.choices.forEach((c, cIndex) => {
            const type = c.isCorrect ? 'correct' : 'incorrect';
            const stroke = c.isCorrect ? '#16a34a' : '#dc2626';
            const fill = c.isCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';

            const hotspot = new fabric.Rect({
              left: startLeft,
              top: qY + 40 + (cIndex * 45),
              width: 30,
              height: 30,
              fill,
              stroke,
              strokeWidth: 2,
              rx: 6,
              ry: 6,
              cornerColor: stroke,
              cornerSize: 8,
            });

            (hotspot as any).isHotspot = true;
            (hotspot as any).hotspotData = {
              type,
              content: `${c.label}) ${c.text}`,
              id: Math.random().toString(36).substr(2, 9)
            };
            fabricCanvas.add(hotspot);

            const optText = new fabric.IText(`${c.label}) ${c.text}`, {
              left: startLeft + 40,
              top: qY + 40 + (cIndex * 45) + 5,
              fontSize: 14,
              fontFamily: 'Inter',
              fill: '#475569'
            });
            fabricCanvas.add(optText);
          });
        }
      });

      fabricCanvas.requestRenderAll();
      setShowQuizModal(false);
    } catch (error) {
      console.error("AI Quiz error:", error);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const duplicateSelection = async () => {
    if (!fabricCanvas) return;
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) return;

    // Support for metadata cloning
    const extraFields = ['isHotspot', 'hotspotData', 'isTemplate'];
    
    const cloned = await activeObject.clone(extraFields);
    fabricCanvas.discardActiveObject();
    
    cloned.set({
      left: cloned.left! + 24,
      top: cloned.top! + 24,
      evented: true,
    });

    if ((cloned as any).isHotspot && (cloned as any).hotspotData) {
      // Give it a new ID
      (cloned as any).hotspotData = { 
        ...(cloned as any).hotspotData, 
        id: Math.random().toString(36).substr(2, 9) 
      };
    }
    
    fabricCanvas.add(cloned);
    fabricCanvas.setActiveObject(cloned);
    fabricCanvas.requestRenderAll();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'h') {
        quickAddHotspot();
      }

      if ((e.ctrlKey || e.metaKey) && key === 'd') {
        e.preventDefault();
        duplicateSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fabricCanvas, isActuallyStudent, activeTool]);

  const [hotspotInfo, setHotspotInfo] = useState<string | null>(null);

  const handleToolChange = (tool: typeof activeTool) => {
    if (!fabricCanvas) return;
    setActiveTool(tool);
    
    fabricCanvas.isDrawingMode = tool === 'draw' || tool === 'eraser';
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();

    if (tool === 'draw') {
      fabricCanvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(fabricCanvas);
      brush.width = 3;
      brush.color = '#004275';
      fabricCanvas.freeDrawingBrush = brush;
    } else if (tool === 'eraser') {
      fabricCanvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(fabricCanvas);
      brush.width = 15;
      brush.color = '#f1f5f9'; // Match background color for simple "erasing"
      fabricCanvas.freeDrawingBrush = brush;
    } else if (tool === 'text') {
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
      const rect = new fabric.Rect({
        width: 40,
        height: 40,
        fill: 'rgba(0, 66, 117, 0.2)',
        stroke: '#004275',
        strokeWidth: 2,
        rx: 8,
        ry: 8,
        originX: 'center',
        originY: 'center'
      });
      const label = new fabric.IText('', {
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fill: '#004275',
        originX: 'center',
        originY: 'center'
      });
      const hotspot = new fabric.Group([rect, label], {
        left: 200,
        top: 200,
        transparentCorners: false,
        cornerColor: '#004275',
        cornerSize: 10
      });
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
    }
 else if (tool === 'check') {
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
        // Compress the image before saving as background
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = img.width!;
        offscreenCanvas.height = img.height!;
        const ctx = offscreenCanvas.getContext('2d')!;
        ctx.drawImage(img.getElement() as HTMLImageElement, 0, 0);
        const compressedData = offscreenCanvas.toDataURL('image/jpeg', 0.7);

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
          updateDoc(doc(db, 'materials', materialId), { url: compressedData });
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
        const PAGE_GAP_PX = 40;
        const cumulativeHeights: number[] = [];

        setNumPages(pdf.numPages);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const offscreenCanvas = document.createElement('canvas');
          const context = offscreenCanvas.getContext('2d');
          offscreenCanvas.height = viewport.height;
          offscreenCanvas.width = viewport.width;
          await page.render({ canvasContext: context!, viewport, canvas: offscreenCanvas }).promise;
          pages.push(offscreenCanvas);
          
          cumulativeHeights.push(totalHeight / 2);
          totalHeight += viewport.height + (i < pdf.numPages ? PAGE_GAP_PX : 0);
          maxWidth = Math.max(maxWidth, viewport.width);
        }
        setPageCumulativeHeights(cumulativeHeights);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = maxWidth;
        finalCanvas.height = totalHeight;
        const ctx = finalCanvas.getContext('2d')!;
        
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, maxWidth, totalHeight);

        let currentY = 0;
        for (const p of pages) {
          const xOffset = (maxWidth - p.width) / 2;
          ctx.shadowColor = 'rgba(0,0,0,0.1)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(xOffset, currentY, p.width, p.height);
          ctx.shadowBlur = 0;
          ctx.drawImage(p, xOffset, currentY);
          currentY += p.height + PAGE_GAP_PX;
        }
        
        const imageUrl = finalCanvas.toDataURL('image/jpeg', 0.85);
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

      // Export canvas to object and explicitly remove backgroundImage to save significant space
      // since we load it separately from material.url
      const obj = fabricCanvas.toObject(['isHotspot', 'hotspotData', 'isTemplate']);
      if (obj.backgroundImage) {
        delete obj.backgroundImage;
      }
      const canvasJson = JSON.stringify(obj);
      
      if (isAdmin && !isPreviewMode) {
        // Teacher saves the template
        await updateDoc(doc(db, 'materials', materialId), {
          description: canvasJson,
          timestamp: serverTimestamp()
        });
        await showAlert("Template saved successfully.", "Success");
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
        await showAlert("Worksheet submitted successfully.", "Success");
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
    
    updateHotspotVisuals(selectedHotspot);
    setUpdateVersion(v => v + 1);
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#004275] border-t-transparent"></div>
    </div>
  );

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    if (pageCumulativeHeights.length === 0) return;
    
    const scrollTop = e.currentTarget.scrollTop;
    const scrollContainerHeight = e.currentTarget.clientHeight;
    const viewCenter = scrollTop + (scrollContainerHeight / 4); // Use upper quadrant for detection
    
    // Find current page based on scroll position
    let newPage = 1;
    for (let i = pageCumulativeHeights.length - 1; i >= 0; i--) {
      const pageTop = pageCumulativeHeights[i] * zoom;
      if (viewCenter >= pageTop) {
        newPage = i + 1;
        break;
      }
    }
    
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

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
                {!isActuallyStudent && (
                  <ToolBtnSquare 
                    active={activeTool === 'hotspot'} 
                    onClick={() => handleToolChange('hotspot')} 
                    icon={<Target className="w-5 h-5" />} 
                    label="Hotspot" 
                    isNew
                  />
                )}
                <ToolBtnSquare 
                  active={activeTool === 'draw'} 
                  onClick={() => handleToolChange('draw')} 
                  icon={<Pencil className="w-5 h-5" />} 
                  label="Brush" 
                />
                <ToolBtnSquare 
                  active={activeTool === 'eraser'} 
                  onClick={() => handleToolChange('eraser')} 
                  icon={<Eraser className="w-5 h-5" />} 
                  label="Eraser" 
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
                  label="Rectangle" 
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

            {!isActuallyStudent && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">AI Assistance</h3>
                  <div className="w-4 h-4 rounded bg-gray-50 flex items-center justify-center border border-gray-100">
                     <div className="w-2 h-[1px] bg-gray-300" />
                  </div>
                </div>
                
                <div className="bg-blue-50/50 rounded-xl p-3 mb-4 border border-blue-100 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-[9px] font-bold text-blue-700 leading-tight">
                    Pro Tip: Draw a <span className="text-blue-900 border-b border-blue-200">Drawing</span> box first, select it, then click AI Detect to scan only that area.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ToolBtnSquare 
                    active={isDetecting} 
                    onClick={handleDetectAnswers} 
                    icon={isDetecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <SearchIcon className="w-5 h-5" />} 
                    label={isDetecting ? "Processing..." : "AI Detect"} 
                    subLabel="Tip: Draw a box to scan specific area"
                  />
                  <ToolBtnSquare 
                    active={false} 
                    onClick={handleClearDetections} 
                    icon={<Trash2 className="w-5 h-5" />} 
                    label="Clear All" 
                  />
                  <ToolBtnSquare 
                    active={showQuizModal} 
                    onClick={() => setShowQuizModal(true)} 
                    icon={<Sparkles className="w-5 h-5" />} 
                    label="Quiz Gen" 
                    isNew
                  />
                </div>
              </div>
            )}

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
                  <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600">
                    {saving ? 'Saving...' : (isActuallyStudent ? 'Submit Work' : 'Save Template')}
                  </span>
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
                  if (!fabricCanvas || !containerRef.current) return;
                  const newZoom = (containerRef.current.clientWidth - 100) / nativeDimensions.width;
                  fabricCanvas.setZoom(newZoom);
                  setZoom(newZoom);
                  // Centering logic
                  const vpt = fabricCanvas.viewportTransform!;
                  vpt[4] = (fabricCanvas.getWidth() - nativeDimensions.width * newZoom) / 2;
                  vpt[5] = 50;
                  fabricCanvas.requestRenderAll();
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
                        updateHotspotVisuals(selectedHotspot);
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
        <main 
          ref={mainRef}
          className="flex-1 overflow-hidden flex flex-col items-center bg-[#f1f5f9] relative"
        >
          {/* Page Indicator */}
          {numPages > 1 && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest z-50 shadow-2xl border border-white/10 flex items-center gap-3">
              <span>Page {currentPage} of {numPages}</span>
              <div className="h-3 w-[1px] bg-white/20" />
              <div className="flex gap-1">
                {Array.from({ length: numPages }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i + 1 === currentPage ? 'bg-blue-400 w-3' : 'bg-white/20'}`} 
                  />
                ))}
              </div>
            </div>
          )}

          <div 
            ref={containerRef}
            className="w-full h-full relative"
          >
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

      {/* Quiz Generator Modal */}
      <AnimatePresence>
        {showQuizModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
              <button 
                onClick={() => setShowQuizModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-tight">AI Quiz Generator</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Number of Questions</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={quizParams.numQuestions}
                    onChange={(e) => setQuizParams({ ...quizParams, numQuestions: parseInt(e.target.value) })}
                    className="w-full accent-blue-600 mb-2"
                  />
                  <div className="flex justify-between text-xs font-bold text-gray-400">
                    <span>1</span>
                    <span className="text-blue-600">{quizParams.numQuestions} Questions</span>
                    <span>10</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Question Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setQuizParams({ ...quizParams, type: 'multiple-choice' })}
                      className={`px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border-2 ${
                        quizParams.type === 'multiple-choice' 
                          ? 'bg-blue-50 border-blue-600 text-blue-600' 
                          : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      Multiple Choice
                    </button>
                    <button 
                      onClick={() => setQuizParams({ ...quizParams, type: 'true-false' })}
                      className={`px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border-2 ${
                        quizParams.type === 'true-false' 
                          ? 'bg-blue-50 border-blue-600 text-blue-600' 
                          : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      True / False
                    </button>
                    <button 
                      onClick={() => setQuizParams({ ...quizParams, type: 'text' })}
                      className={`px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border-2 ${
                        quizParams.type === 'text' 
                          ? 'bg-blue-50 border-blue-600 text-blue-600' 
                          : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      Short Answer
                    </button>
                  </div>
                </div>

                {quizParams.type === 'multiple-choice' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Options per Question</label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5].map(n => (
                        <button 
                          key={n}
                          onClick={() => setQuizParams({ ...quizParams, numOptions: n })}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                            quizParams.numOptions === n 
                              ? 'bg-blue-50 border-blue-600 text-blue-600' 
                              : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleGenerateQuizAI}
                  disabled={isGeneratingQuiz}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-100 mt-4"
                >
                  {isGeneratingQuiz ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Content
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolBtnSquare({ active, onClick, icon, label, isNew, subLabel }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, isNew?: boolean, subLabel?: string }) {
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
      <div className="flex flex-col items-center">
        <span className={`text-[10px] font-bold transition-all duration-300 ${active ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-600'}`}>
          {label}
        </span>
        {subLabel && (
          <span className="text-[7px] text-gray-300 font-bold max-w-[80px] text-center leading-tight">
            {subLabel}
          </span>
        )}
      </div>
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
