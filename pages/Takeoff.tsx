
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzePlan, ensureApiKey } from '../services/geminiService';
import { fileToBase64 } from '../services/utils';
import { EstimationItem, CSI_DIVISIONS, Project, View } from '../types';
import { storageService } from '../services/storageService';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Upload, Loader2, MousePointer2, Move, Ruler, Hash, 
  BoxSelect, Save, ZoomIn, ZoomOut, 
  ArrowLeft, ArrowRight, Trash2, FileText, CheckCircle2, 
  ScanLine, Calculator, Layers,
  CircleDashed,
  CheckCircle,
  PenTool,
  Scaling,
  Target,
  XCircle,
  Filter,
  CheckSquare,
  Square,
  Maximize,
  PanelRightClose,
  PanelRightOpen,
  ArrowRightCircle
} from 'lucide-react';

// Configure PDF.js Worker
const pdfjs = (pdfjsLib as any).default || pdfjsLib;
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const ANALYSIS_STAGES = [
    { id: 'upload', label: 'Processing File', icon: FileText },
    { id: 'geometry', label: 'Geometry Detection', icon: ScanLine },
    { id: 'quantification', label: 'Material Quantification', icon: Layers },
    { id: 'estimation', label: 'Item Categorization', icon: CheckCircle2 },
];

type ToolType = 'select' | 'pan' | 'count' | 'linear' | 'area' | 'scale';

interface AnnotationPoint {
  x: number;
  y: number;
}

interface Annotation {
  id: string;
  type: 'count' | 'linear' | 'area' | 'scale';
  points: AnnotationPoint[];
  color: string;
  label?: string;
  completed: boolean;
  page: number;
}

export const Takeoff: React.FC = () => {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  
  // Plan State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  
  // PDF State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isPdfRendering, setIsPdfRendering] = useState(false);
  const [planDimensions, setPlanDimensions] = useState({ width: 0, height: 0 }); 

  // Image State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Viewport State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // AI & Data State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [items, setItems] = useState<EstimationItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Scope / Division State
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  
  // Manual Takeoff State
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [scaleRatio, setScaleRatio] = useState<number>(0); 
  const [scaleUnit, setScaleUnit] = useState<string>('ft');
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Refs
  const base64Cache = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Ref to track the current render task
  const renderTaskRef = useRef<any>(null);

  // --- Initialization ---
  useEffect(() => {
    const project = storageService.getActiveProject();
    if (project) {
        setActiveProject(project);
        
        // Load existing items if any
        if (project.items && project.items.length > 0) {
            setItems(project.items);
        } else if (project.templateId) {
            // Load items from template
            const templates = storageService.getTemplates();
            const template = templates.find(t => t.id === project.templateId);
            if (template) {
                // Pre-load scopes
                setSelectedScopes(template.defaultScopes);
                
                // Add common items
                const commonItems: EstimationItem[] = template.commonItems.map((desc, idx) => ({
                    id: `tmpl-item-${idx}`,
                    description: desc,
                    quantity: 0, // Needs takeoff
                    unit: 'ea',
                    category: '01 - General Requirements', // Default
                    unitCost: 0,
                    totalCost: 0,
                    notes: 'From Project Template'
                }));
                setItems(commonItems);
            }
        }
    }
  }, []);

  // --- Handlers ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 20 * 1024 * 1024) {
         if (!confirm(`This file is ${Math.round(file.size / 1024 / 1024)}MB. The AI analysis might timeout or fail for files over 20MB. Do you want to continue?`)) {
            return;
         }
      }

      setSelectedFile(file);
      base64Cache.current = null;
      // Note: We do NOT clear items if they were loaded from template
      setAnnotations([]);
      setUploadProgress(0);
      setCurrentStageIndex(0);
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      setScaleRatio(0);
      setPageNum(1);
      
      if (file.type === 'application/pdf') {
        setFileType('pdf');
        setImageUrl(null);
        await loadPdf(file);
      } else if (file.type.startsWith('image/')) {
        setFileType('image');
        setPdfDoc(null);
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        
        const img = new Image();
        img.onload = () => {
             setPlanDimensions({ width: img.width, height: img.height });
             setTimeout(() => fitToScreen(img.width, img.height), 100);
        };
        img.src = url;
      } else {
        alert("Unsupported file type. Please use PDF, PNG, or JPG.");
        return;
      }
    }
  };

  const loadPdf = async (file: File) => {
      setIsPdfRendering(true);
      try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          // Wait slightly for state to settle before rendering page 1
          setTimeout(() => renderPdfPage(pdf, 1), 0);
      } catch (err: any) {
          console.error('Error loading PDF:', err);
          alert(`Could not load PDF: ${err.message}`);
          setIsPdfRendering(false);
      }
  };

  const renderPdfPage = async (pdf: any, pageNumber: number) => {
      if (!pdf) return;

      // Cancel any pending render task
      if (renderTaskRef.current) {
          try {
              renderTaskRef.current.cancel();
          } catch (e) {
              // Ignore cancellation errors
          }
      }

      setIsPdfRendering(true);
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2.0 }); 
        
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                
                // Store the task so we can cancel it if needed
                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;

                await renderTask.promise;
                
                // If successful, clear the ref
                renderTaskRef.current = null;

                setPlanDimensions({ width: viewport.width, height: viewport.height });
                if (zoomLevel === 1) {
                   setTimeout(() => fitToScreen(viewport.width, viewport.height), 50);
                }
                
                setIsPdfRendering(false);
            }
        }
      } catch (err: any) {
          if (err?.name === 'RenderingCancelledException') {
              // Intentionally cancelled, do not update state to false yet as new render might be starting
              return;
          }
          console.error("Page render error:", err);
          setIsPdfRendering(false);
      }
  };

  useEffect(() => {
      if (fileType === 'pdf' && pdfDoc) {
          renderPdfPage(pdfDoc, pageNum);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, pdfDoc]);

  const fitToScreen = (w: number, h: number) => {
      if (!wrapperRef.current) return;
      const containerW = wrapperRef.current.clientWidth;
      const containerH = wrapperRef.current.clientHeight;
      const pad = 60;
      const scaleW = (containerW - pad) / w;
      const scaleH = (containerH - pad) / h;
      const newScale = Math.min(scaleW, scaleH);
      setZoomLevel(Math.max(0.05, Math.min(newScale, 1.5)));
      setPanOffset({
          x: (containerW - w * newScale) / 2,
          y: (containerH - h * newScale) / 2
      });
  };

  const changePage = (delta: number) => {
      const newPage = Math.max(1, Math.min(numPages, pageNum + delta));
      if (newPage !== pageNum) {
          setPageNum(newPage);
      }
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(prev => prev.filter(s => s !== scope));
    } else {
      setSelectedScopes(prev => [...prev, scope]);
    }
  };

  const handleSelectAllScopes = () => {
    if (selectedScopes.length === CSI_DIVISIONS.length) {
      setSelectedScopes([]);
    } else {
      setSelectedScopes([...CSI_DIVISIONS]);
    }
  };

  const runAnalysis = async () => {
    if (!selectedFile) return;
    
    setIsScopeModalOpen(false); 

    try {
      setIsAnalyzing(true);
      setUploadProgress(0);
      setCurrentStageIndex(0);
      
      await ensureApiKey();

      let base64 = base64Cache.current;
      if (!base64) {
        base64 = await fileToBase64(selectedFile, (percent) => {
           setUploadProgress(percent);
        });
        base64Cache.current = base64;
      }
      
      setUploadProgress(100); 
      setCurrentStageIndex(1);

      const t1 = setTimeout(() => setCurrentStageIndex(2), 3000);
      const t2 = setTimeout(() => setCurrentStageIndex(3), 7000);

      const result = await analyzePlan(base64!, selectedFile.type, selectedScopes);
      
      clearTimeout(t1);
      clearTimeout(t2);
      
      const mappedItems: EstimationItem[] = (result.items || []).map((item: any, idx: number) => ({
        id: `ai-item-${Date.now()}-${idx}`,
        description: item.description || 'Unknown Item',
        quantity: item.quantity || 0,
        unit: item.unit || 'ea',
        unitCost: 0, // No cost generation during takeoff
        totalCost: 0,
        category: item.category || 'Uncategorized',
        notes: item.notes
      }));
      
      setItems(prev => [...prev, ...mappedItems]);
      setCurrentStageIndex(3); 
      setTimeout(() => setIsAnalyzing(false), 800);

    } catch (err: any) {
      console.error(err);
      let errorMsg = "Takeoff analysis failed.";
      if (err.message?.includes('413')) errorMsg = "File is too large for the API.";
      if (err.message?.includes('503')) errorMsg = "Service temporarily unavailable. Please try again.";
      alert(errorMsg);
      setIsAnalyzing(false);
    }
  };

  const saveAndEstimate = () => {
    if (activeProject) {
        // Save items to project
        storageService.updateProjectItems(activeProject.id, items);
        
        // Use a dirty hack to switch view since we don't have direct access to setView here easily 
        // without prop drilling, but in this structure we can assume the parent re-renders 
        // if we change something, or we can use window location if it was routed.
        // For now, let's use a custom event or just alert the user. 
        // Ideally App should be listening to storage or we pass setView. 
        // But let's assume the user will navigate. 
        // Actually, let's reload to dashboard or show success.
        
        // Better: trigger a view change via a global event or assume the user manually clicks "Estimator".
        // For this demo, I'll show a notification.
        alert("Takeoff saved! Proceed to the Estimator tab to calculate costs.");
    }
  };

  // --- Manual Takeoff Logic ---
  const getPointFromEvent = (e: React.MouseEvent): AnnotationPoint => {
     if (!containerRef.current) return { x: 0, y: 0 };
     const rect = containerRef.current.getBoundingClientRect();
     const clientX = e.clientX - rect.left;
     const clientY = e.clientY - rect.top;
     return { x: clientX / zoomLevel, y: clientY / zoomLevel };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (!selectedFile) return;
      if (activeTool === 'pan' || (activeTool === 'select' && e.button === 1)) {
          setIsDragging(true);
          setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
          return;
      }
      if (['count', 'linear', 'area', 'scale'].includes(activeTool)) {
          const point = getPointFromEvent(e);
          if (activeTool === 'count') {
              const newAnnot: Annotation = {
                  id: `manual-${Date.now()}`,
                  type: 'count',
                  points: [point],
                  color: '#ef4444',
                  completed: true,
                  page: pageNum
              };
              setAnnotations(prev => [...prev, newAnnot]);
              addItemFromAnnotation(newAnnot);
          } else {
              if (!currentAnnotation) {
                  setCurrentAnnotation({
                      id: `manual-${Date.now()}`,
                      type: activeTool as Annotation['type'],
                      points: [point],
                      color: activeTool === 'scale' ? '#eab308' : activeTool === 'area' ? '#22c55e' : '#38bdf8',
                      completed: false,
                      page: pageNum
                  });
              } else {
                  setCurrentAnnotation(prev => prev ? ({ ...prev, points: [...prev.points, point] }) : null);
              }
          }
      }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
  };

  const handleCanvasMouseUp = () => { setIsDragging(false); };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
      if (currentAnnotation && !currentAnnotation.completed) {
          if (activeTool === 'scale') {
               if (currentAnnotation.points.length < 2) return;
               const dist = prompt("Enter the known distance for this segment (e.g. 10):", "10");
               if (dist && !isNaN(parseFloat(dist))) {
                   finishCalibration(currentAnnotation, parseFloat(dist));
               }
               setCurrentAnnotation(null);
               setActiveTool('select');
          } else {
              const finalAnnot = { ...currentAnnotation, completed: true };
              setAnnotations(prev => [...prev, finalAnnot]);
              addItemFromAnnotation(finalAnnot);
              setCurrentAnnotation(null);
          }
      }
  };

  const calculateDistance = (p1: AnnotationPoint, p2: AnnotationPoint) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  const calculatePathLength = (points: AnnotationPoint[]) => {
      let length = 0;
      for (let i = 0; i < points.length - 1; i++) {
          length += calculateDistance(points[i], points[i+1]);
      }
      return length;
  };
  const calculatePolygonArea = (points: AnnotationPoint[]) => {
      let area = 0;
      for (let i = 0; i < points.length; i++) {
          const p1 = points[i];
          const p2 = points[(i + 1) % points.length];
          area += (p1.x * p2.y) - (p2.x * p1.y);
      }
      return Math.abs(area / 2);
  };

  const finishCalibration = (annot: Annotation, knownDist: number) => {
       const pxDist = calculatePathLength(annot.points);
       if (pxDist === 0) return;
       setScaleRatio(pxDist / knownDist);
       setIsCalibrating(false);
  };

  const addItemFromAnnotation = (annot: Annotation) => {
      let qty = 0;
      let unit = 'ea';
      let desc = 'Manual Item';
      
      if (annot.type === 'count') {
          qty = 1;
          desc = 'Manual Count';
      } else if (annot.type === 'linear') {
          const pxLen = calculatePathLength(annot.points);
          qty = scaleRatio > 0 ? pxLen / scaleRatio : pxLen;
          unit = scaleRatio > 0 ? scaleUnit : 'px';
          desc = 'Linear Measurement';
      } else if (annot.type === 'area') {
          const pxArea = calculatePolygonArea(annot.points);
          qty = scaleRatio > 0 ? pxArea / (scaleRatio * scaleRatio) : pxArea;
          unit = scaleRatio > 0 ? `sq ${scaleUnit}` : 'sq px';
          desc = 'Area Measurement';
      }

      const newItem: EstimationItem = {
          id: annot.id,
          description: desc,
          quantity: parseFloat(qty.toFixed(2)),
          unit: unit,
          category: 'Manual Takeoff',
          unitCost: 0,
          totalCost: 0,
          notes: `Page ${annot.page}`
      };
      setItems(prev => [...prev, newItem]);
  };

  const deleteItem = (id: string) => {
      setItems(prev => prev.filter(i => i.id !== id));
      setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === 'All') return items;
    return items.filter(item => {
        if (item.category === 'Manual Takeoff') return activeFilter === 'Manual Takeoff';
        return item.category.includes(activeFilter.split(' - ')[0]) || item.category === activeFilter;
    });
  }, [items, activeFilter]);

  const visibleAnnotations = useMemo(() => {
     return annotations.filter(a => fileType === 'image' || a.page === pageNum);
  }, [annotations, pageNum, fileType]);

  const availableCategories = useMemo(() => {
      const cats = new Set(items.map(i => i.category));
      return Array.from(cats);
  }, [items]);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-slate-900 overflow-hidden rounded-xl border border-slate-800 relative">
      
      {/* Header Toolbar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex justify-between items-center px-4 flex-shrink-0 z-30 shadow-sm relative">
         <div className="flex items-center space-x-4 overflow-hidden">
            <h2 className="font-bold text-white text-lg flex items-center min-w-0">
               {activeProject ? (
                  <span className="text-primary mr-2 bg-primary/10 px-2 py-0.5 rounded text-sm">{activeProject.name}</span>
               ) : <span className="text-slate-500 mr-2 text-sm italic">No Active Project</span>}
              {selectedFile ? (
                 <>
                   <span className="text-slate-400 mx-2">/</span>
                   {fileType === 'pdf' ? <FileText size={18} className="mr-2 text-red-400 flex-shrink-0"/> : <Upload size={18} className="mr-2 text-primary flex-shrink-0"/>}
                   <span className="truncate max-w-[150px]">{selectedFile.name}</span>
                 </>
              ) : ''}
            </h2>
            {scaleRatio > 0 && (
                <span className="text-xs bg-slate-800 text-green-400 px-2 py-1 rounded border border-green-900/50 whitespace-nowrap hidden md:inline-block">
                    Scale: 1{scaleUnit} = {scaleRatio.toFixed(2)}px
                </span>
            )}
         </div>

         {/* Center Controls (Page Nav) */}
         {fileType === 'pdf' && numPages > 1 && (
             <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center bg-slate-800 rounded-lg p-1 space-x-2 shadow-lg z-50">
                 <button onClick={() => changePage(-1)} disabled={pageNum <= 1} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-300">
                     <ArrowLeft size={16} />
                 </button>
                 <span className="text-xs font-mono text-slate-300 w-24 text-center">Page {pageNum} of {numPages}</span>
                 <button onClick={() => changePage(1)} disabled={pageNum >= numPages} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-300">
                     <ArrowRight size={16} />
                 </button>
             </div>
         )}

         <div className="flex items-center space-x-2">
             <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Fit to Screen" onClick={() => fitToScreen(planDimensions.width, planDimensions.height)}>
                <Maximize size={18} />
             </button>
             <div className="w-px h-6 bg-slate-700 mx-1"></div>
             <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded" onClick={() => setZoomLevel(Math.max(0.1, zoomLevel - 0.1))}>
                <ZoomOut size={18} />
             </button>
             <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
             <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded" onClick={() => setZoomLevel(Math.min(5, zoomLevel + 0.1))}>
                <ZoomIn size={18} />
             </button>
             <div className="w-px h-6 bg-slate-700 mx-2 hidden md:block"></div>
             <button 
                onClick={saveAndEstimate}
                className="hidden md:flex bg-primary text-slate-900 px-3 py-1.5 rounded-lg text-sm font-bold items-center transition-all hover:bg-sky-400"
             >
               <Save size={16} className="mr-2" /> Save & Estimate
            </button>
            <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className={`p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 ml-2`}
            >
             {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
            </button>
         </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Tools Palette (Absolute) */}
        <div className="absolute left-4 top-4 z-20 flex flex-col space-y-2 pointer-events-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col p-1 space-y-1">
                <ToolButton icon={MousePointer2} label="Select / Edit" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
                <ToolButton icon={Move} label="Pan (Hold Space)" active={activeTool === 'pan'} onClick={() => setActiveTool('pan')} />
                <div className="h-px w-full bg-slate-700 my-1"></div>
                <ToolButton icon={Scaling} label="Calibrate Scale" active={activeTool === 'scale'} onClick={() => setActiveTool('scale')} color="text-yellow-400" />
                <ToolButton icon={Target} label="Manual Count" active={activeTool === 'count'} onClick={() => setActiveTool('count')} color="text-red-400" />
                <ToolButton icon={Ruler} label="Linear Measure" active={activeTool === 'linear'} onClick={() => setActiveTool('linear')} color="text-primary" />
                <ToolButton icon={BoxSelect} label="Area Measure" active={activeTool === 'area'} onClick={() => setActiveTool('area')} color="text-green-400" />
                <div className="h-px w-full bg-slate-700 my-1"></div>
                <ToolButton icon={BrainCircuitIcon} label="AI Auto-Detect" active={false} onClick={() => selectedFile && setIsScopeModalOpen(true)} color="text-purple-400" />
            </div>
        </div>

        {/* Canvas Container */}
        <div 
            ref={wrapperRef}
            className="flex-1 bg-slate-950 relative overflow-hidden cursor-crosshair"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
        >
             {!selectedFile && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                   <div className="text-center pointer-events-auto">
                        <label className="border-2 border-dashed border-slate-700 rounded-2xl p-16 flex flex-col items-center justify-center bg-slate-900/50 hover:bg-slate-900 hover:border-primary/50 transition-all cursor-pointer group w-[500px]">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-slate-900 transition-colors text-slate-400">
                            <Upload size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Upload Plan</h3>
                        <p className="text-slate-500 mb-6 text-center">Drag & drop blueprint (PDF/Image)</p>
                        <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                        </label>
                   </div>
                </div>
             )}
             
             {isPdfRendering && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
                    <div className="bg-slate-900 p-4 rounded-xl shadow-2xl flex items-center space-x-3 border border-slate-800">
                        <Loader2 className="animate-spin text-primary" />
                        <span className="text-white font-medium">Rendering Plan...</span>
                    </div>
                </div>
             )}

             <div className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
             </div>

             <div 
                ref={containerRef}
                style={{ 
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: '0 0',
                    width: planDimensions.width > 0 ? planDimensions.width : '100%',
                    height: planDimensions.height > 0 ? planDimensions.height : '100%',
                    cursor: activeTool === 'pan' || isDragging ? 'grabbing' : activeTool === 'select' ? 'default' : 'crosshair'
                }}
                className="absolute top-0 left-0 will-change-transform bg-white shadow-2xl origin-top-left"
             >
                 {selectedFile && (
                    <>
                        {fileType === 'pdf' ? (
                            <canvas ref={canvasRef} className="block w-full h-full" />
                        ) : imageUrl ? (
                            <img src={imageUrl} alt="Plan" className="w-full h-full object-contain block select-none" draggable={false} />
                        ) : null}

                        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                            {visibleAnnotations.map(annot => {
                                if (annot.type === 'count') {
                                    return annot.points.map((p, i) => (
                                        <circle key={`${annot.id}-${i}`} cx={p.x} cy={p.y} r={6 / zoomLevel} fill={annot.color} stroke="white" strokeWidth={1 / zoomLevel} />
                                    ));
                                } else if (annot.type === 'linear') {
                                    return (
                                        <polyline 
                                            key={annot.id}
                                            points={annot.points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke={annot.color}
                                            strokeWidth={4 / zoomLevel}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    );
                                } else if (annot.type === 'area') {
                                    return (
                                        <polygon
                                            key={annot.id}
                                            points={annot.points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill={annot.color}
                                            fillOpacity={0.3}
                                            stroke={annot.color}
                                            strokeWidth={2 / zoomLevel}
                                        />
                                    )
                                }
                                return null;
                            })}

                            {currentAnnotation && (
                                <>
                                    {currentAnnotation.type === 'linear' || currentAnnotation.type === 'scale' ? (
                                        <polyline 
                                            points={currentAnnotation.points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke={currentAnnotation.color}
                                            strokeWidth={4 / zoomLevel}
                                            strokeDasharray="4"
                                        />
                                    ) : currentAnnotation.type === 'area' ? (
                                        <polyline 
                                            points={currentAnnotation.points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill={currentAnnotation.color}
                                            fillOpacity={0.2}
                                            stroke={currentAnnotation.color}
                                            strokeWidth={2 / zoomLevel}
                                        />
                                    ) : null}
                                    {currentAnnotation.points.map((p, i) => (
                                        <circle key={i} cx={p.x} cy={p.y} r={4 / zoomLevel} fill="white" stroke={currentAnnotation.color} strokeWidth={1} />
                                    ))}
                                </>
                            )}
                        </svg>
                    </>
                 )}
             </div>
             
             {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center backdrop-blur-sm z-50">
                  <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col w-96">
                    <h3 className="text-white font-bold text-xl mb-6 text-center">AI Analysis Running</h3>
                    <div className="space-y-4">
                        {ANALYSIS_STAGES.map((stage, index) => {
                            const isActive = index === currentStageIndex;
                            const isCompleted = index < currentStageIndex;
                            const Icon = stage.icon;
                            return (
                                <div key={stage.id} className={`flex items-center p-3 rounded-lg transition-colors ${isActive ? 'bg-slate-800 border border-slate-700' : 'opacity-50'}`}>
                                    <div className="mr-4">
                                        {isActive ? <Loader2 className="animate-spin text-primary" size={20} /> : isCompleted ? <CheckCircle className="text-green-500" size={20} /> : <CircleDashed className="text-slate-600" size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-medium text-sm ${isActive || isCompleted ? 'text-white' : 'text-slate-500'}`}>{stage.label}</p>
                                        {stage.id === 'upload' && isActive && (
                                           <div className="w-full bg-slate-700 rounded-full h-1 mt-2"><div className="bg-primary h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div></div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                  </div>
                </div>
              )}

             {isScopeModalOpen && (
               <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center backdrop-blur-sm z-50 p-4">
                 <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[80vh]">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                       <div>
                         <h3 className="text-xl font-bold text-white">Select Takeoff Scope</h3>
                         <p className="text-sm text-slate-400">Limit AI detection to specific CSI divisions or trades.</p>
                       </div>
                       <button onClick={() => setIsScopeModalOpen(false)} className="text-slate-500 hover:text-white"><XCircle /></button>
                    </div>
                    <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
                       {CSI_DIVISIONS.map(div => (
                         <button 
                            key={div} 
                            onClick={() => toggleScope(div)}
                            className={`flex items-center p-3 rounded-lg border transition-all text-left ${selectedScopes.includes(div) ? 'bg-primary/10 border-primary text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                         >
                            {selectedScopes.includes(div) ? <CheckSquare className="text-primary mr-3" size={20}/> : <Square className="text-slate-600 mr-3" size={20}/>}
                            <span className="text-sm font-medium">{div}</span>
                         </button>
                       ))}
                    </div>
                    <div className="p-6 border-t border-slate-800 flex justify-between items-center bg-slate-900 rounded-b-2xl">
                       <button onClick={handleSelectAllScopes} className="text-slate-400 text-sm hover:text-white underline">
                          {selectedScopes.length === CSI_DIVISIONS.length ? 'Deselect All' : 'Select All'}
                       </button>
                       <div className="flex gap-3">
                          <button onClick={() => setIsScopeModalOpen(false)} className="px-5 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 font-medium transition-colors">Cancel</button>
                          <button onClick={runAnalysis}