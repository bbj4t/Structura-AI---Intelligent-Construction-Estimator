
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzePlan, ensureApiKey } from '../services/geminiService';
import { fileToBase64, formatCurrency } from '../services/utils';
import { EstimationItem, CSI_DIVISIONS } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  Upload, Loader2, MousePointer2, Move, Ruler, Hash, 
  BoxSelect, Save, Download, ZoomIn, ZoomOut, 
  ChevronRight, ChevronLeft, Trash2, FileText, CheckCircle2, 
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
  ArrowLeft,
  ArrowRight,
  PanelLeftClose,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';

// Configure PDF.js Worker
// Fix for ESM default export behavior if necessary
const pdfjs = (pdfjsLib as any).default || pdfjsLib;
// Use CDNJS for the worker to avoid cross-origin importScripts errors often seen with esm.sh workers
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const ANALYSIS_STAGES = [
    { id: 'upload', label: 'Processing File', icon: FileText },
    { id: 'geometry', label: 'Geometry Detection', icon: ScanLine },
    { id: 'quantification', label: 'Material Quantification', icon: Layers },
    { id: 'estimation', label: 'Cost Estimation Structure', icon: CheckCircle2 },
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
  page: number; // Page number association
}

export const Takeoff: React.FC = () => {
  // Plan State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  
  // PDF State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isPdfRendering, setIsPdfRendering] = useState(false);
  const [planDimensions, setPlanDimensions] = useState({ width: 0, height: 0 }); // Natural dimensions of current page/image

  // Image State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Viewport State
  const [zoomLevel, setZoomLevel] = useState(1); // Visual zoom
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
  const [scaleRatio, setScaleRatio] = useState<number>(0); // pixels per unit
  const [scaleUnit, setScaleUnit] = useState<string>('ft');
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Refs
  const base64Cache = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For PDF rendering
  const wrapperRef = useRef<HTMLDivElement>(null); // Scrollable wrapper

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
      setItems([]);
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
        
        // Get dimensions
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
          // Use a typed array to avoid some worker cloning issues
          const uint8Array = new Uint8Array(arrayBuffer);
          const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          await renderPdfPage(pdf, 1);
      } catch (err: any) {
          console.error('Error loading PDF:', err);
          alert(`Could not load PDF: ${err.message}`);
      } finally {
          setIsPdfRendering(false);
      }
  };

  const renderPdfPage = async (pdf: any, pageNumber: number) => {
      if (!pdf) return;
      setIsPdfRendering(true);
      try {
        const page = await pdf.getPage(pageNumber);
        // Render at a higher scale for better quality on zoom
        const viewport = page.getViewport({ scale: 2.0 }); 
        
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const context = canvas.getContext('2d');
            if (context) {
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                // Adjust plan dimensions to match the rendered canvas size
                // We treat this as the "100%" size for annotations
                setPlanDimensions({ width: viewport.width, height: viewport.height });
                
                // Only fit to screen on initial load or if user hasn't messed with zoom
                if (zoomLevel === 1) {
                   setTimeout(() => fitToScreen(viewport.width, viewport.height), 50);
                }
            }
        }
      } catch (err) {
          console.error("Page render error:", err);
      } finally {
          setIsPdfRendering(false);
      }
  };

  useEffect(() => {
      if (fileType === 'pdf' && pdfDoc) {
          renderPdfPage(pdfDoc, pageNum);
      }
  }, [pageNum, pdfDoc]);

  const fitToScreen = (w: number, h: number) => {
      if (!wrapperRef.current) return;
      const containerW = wrapperRef.current.clientWidth;
      const containerH = wrapperRef.current.clientHeight;
      
      // Calculate scale to fit
      const pad = 60;
      const scaleW = (containerW - pad) / w;
      const scaleH = (containerH - pad) / h;
      
      const newScale = Math.min(scaleW, scaleH);
      
      // Don't zoom in excessively if the image is tiny, but ensure it's visible
      // Set a reasonable min/max
      setZoomLevel(Math.max(0.05, Math.min(newScale, 1.5)));
      
      // Center it
      const finalW = w * newScale;
      const finalH = h * newScale;
      
      setPanOffset({
          x: (containerW - finalW) / 2, // Center horizontally
          y: (containerH - finalH) / 2  // Center vertically
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
    
    setIsScopeModalOpen(false); // Close modal if open

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

      // Pass the *current* page if PDF? 
      // For now, API analyzes the whole file upload or first page. 
      // We send the file itself.
      const result = await analyzePlan(base64!, selectedFile.type, selectedScopes);
      
      clearTimeout(t1);
      clearTimeout(t2);
      
      const mappedItems: EstimationItem[] = (result.items || []).map((item: any, idx: number) => ({
        id: `ai-item-${Date.now()}-${idx}`,
        description: item.description || 'Unknown Item',
        quantity: item.quantity || 0,
        unit: item.unit || 'ea',
        unitCost: 0,
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

  // --- Manual Takeoff Logic ---

  const getPointFromEvent = (e: React.MouseEvent): AnnotationPoint => {
     if (!containerRef.current) return { x: 0, y: 0 };
     const rect = containerRef.current.getBoundingClientRect();
     
     const clientX = e.clientX - rect.left;
     const clientY = e.clientY - rect.top;
     
     // The content is scaled by zoomLevel. 
     // Coordinate system should be relative to the unscaled plan dimensions.
     const x = clientX / zoomLevel;
     const y = clientY / zoomLevel;
     
     return { x, y };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (!selectedFile) return;

      // Pan Logic
      if (activeTool === 'pan' || (activeTool === 'select' && e.button === 1)) {
          setIsDragging(true);
          setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
          return;
      }

      // Drawing Logic
      if (['count', 'linear', 'area', 'scale'].includes(activeTool)) {
          const point = getPointFromEvent(e);

          if (activeTool === 'count') {
              // Immediate add
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
              // Poly start or continue
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
                  setCurrentAnnotation(prev => prev ? ({
                      ...prev,
                      points: [...prev.points, point]
                  }) : null);
              }
          }
      }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          setPanOffset({
              x: e.clientX - dragStart.x,
              y: e.clientY - dragStart.y
          });
      }
  };

  const handleCanvasMouseUp = () => {
      setIsDragging(false);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
      if (currentAnnotation && !currentAnnotation.completed) {
          // Finish measurement
          if (activeTool === 'scale') {
               if (currentAnnotation.points.length < 2) return;
               // Prompt for distance
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

  // --- Calculation Helpers ---

  const calculateDistance = (p1: AnnotationPoint, p2: AnnotationPoint) => {
      return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const calculatePathLength = (points: AnnotationPoint[]) => {
      let length = 0;
      for (let i = 0; i < points.length - 1; i++) {
          length += calculateDistance(points[i], points[i+1]);
      }
      return length;
  };

  const calculatePolygonArea = (points: AnnotationPoint[]) => {
      let area = 0;
      const j = points.length - 1;
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
          qty = scaleRatio > 0 ? pxLen / scaleRatio : pxLen; // fallback to px if no scale
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

  const updateItemCost = (id: string, cost: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, unitCost: cost, totalCost: cost * item.quantity };
      }
      return item;
    }));
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === 'All') return items;
    return items.filter(item => {
        if (item.category === 'Manual Takeoff') return activeFilter === 'Manual Takeoff';
        return item.category.includes(activeFilter.split(' - ')[0]) || item.category === activeFilter;
    });
  }, [items, activeFilter]);

  // Filter annotations for current page
  const visibleAnnotations = useMemo(() => {
     return annotations.filter(a => fileType === 'image' || a.page === pageNum);
  }, [annotations, pageNum, fileType]);

  const totalProjectCost = items.reduce((acc, curr) => acc + curr.totalCost, 0);
  const isPdf = fileType === 'pdf';

  const availableCategories = useMemo(() => {
      const cats = new Set(items.map(i => i.category));
      return Array.from(cats);
  }, [items]);

  // --- Render ---

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-slate-900 overflow-hidden rounded-xl border border-slate-800 relative">
      
      {/* Header Toolbar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex justify-between items-center px-4 flex-shrink-0 z-30 shadow-sm relative">
         <div className="flex items-center space-x-4 overflow-hidden">
            <h2 className="font-bold text-white text-lg flex items-center min-w-0">
              {selectedFile ? (
                 <>
                   {isPdf ? <FileText size={18} className="mr-2 text-red-400 flex-shrink-0"/> : <Upload size={18} className="mr-2 text-primary flex-shrink-0"/>}
                   <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                 </>
              ) : 'Untitled Project'}
            </h2>
            {scaleRatio > 0 && (
                <span className="text-xs bg-slate-800 text-green-400 px-2 py-1 rounded border border-green-900/50 whitespace-nowrap hidden md:inline-block">
                    Scale: 1{scaleUnit} = {scaleRatio.toFixed(2)}px
                </span>
            )}
         </div>

         {/* Center Controls (Page Nav) */}
         {isPdf && numPages > 1 && (
             <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center bg-slate-800 rounded-lg p-1 space-x-2 shadow-lg z-50">
                 <button 
                    onClick={() => changePage(-1)}
                    disabled={pageNum <= 1}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-300"
                    title="Previous Page"
                 >
                     <ArrowLeft size={16} />
                 </button>
                 <span className="text-xs font-mono text-slate-300 w-24 text-center">
                    Page {pageNum} of {numPages}
                 </span>
                 <button 
                    onClick={() => changePage(1)}
                    disabled={pageNum >= numPages}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-300"
                    title="Next Page"
                 >
                     <ArrowRight size={16} />
                 </button>
             </div>
         )}

         <div className="flex items-center space-x-2">
             <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Fit to Screen" onClick={() => fitToScreen(planDimensions.width, planDimensions.height)}>
                <Maximize size={18} />
             </button>
             <div className="w-px h-6 bg-slate-700 mx-1"></div>
             <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Zoom Out" onClick={() => setZoomLevel(Math.max(0.1, zoomLevel - 0.1))}>
                <ZoomOut size={18} />
             </button>
             <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
             <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Zoom In" onClick={() => setZoomLevel(Math.min(5, zoomLevel + 0.1))}>
                <ZoomIn size={18} />
             </button>
             <div className="w-px h-6 bg-slate-700 mx-2 hidden md:block"></div>
             <button 
                onClick={() => items.length > 0 && alert("Export feature coming soon")}
                className="hidden md:flex bg-primary/10 text-primary hover:bg-primary hover:text-slate-900 px-3 py-1.5 rounded-lg text-sm font-bold items-center transition-all"
             >
               <Save size={16} className="mr-2" /> Export
            </button>
            <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className={`p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 ml-2`}
             title="Toggle Sidebar"
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

             {/* Grid Background */}
             <div className="absolute inset-0 opacity-10 pointer-events-none" 
                  style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
             </div>

             {/* Transform Layer */}
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
                        {/* Render Layer */}
                        {isPdf ? (
                            <canvas ref={canvasRef} className="block w-full h-full" />
                        ) : imageUrl ? (
                            <img src={imageUrl} alt="Plan" className="w-full h-full object-contain block select-none" draggable={false} />
                        ) : null}

                        {/* Annotation SVG Overlay */}
                        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                            {/* Existing Annotations */}
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

                            {/* Current Drawing */}
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
             
             {/* Tool Tip / Instruction Overlay */}
             {activeTool !== 'select' && activeTool !== 'pan' && (
                 <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm border border-slate-700 shadow-xl z-30 pointer-events-none">
                     {activeTool === 'scale' && "Click two points to define a known distance. Double-click to finish."}
                     {activeTool === 'linear' && "Click points to measure distance. Double-click to finish."}
                     {activeTool === 'area' && "Click corners to measure area. Double-click to close polygon."}
                     {activeTool === 'count' && "Click to place markers."}
                 </div>
             )}

             {/* Progress Overlay */}
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

             {/* Scope Selection Modal */}
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
                          <button onClick={runAnalysis} className="bg-primary text-slate-900 px-6 py-2.5 rounded-lg font-bold hover:bg-sky-400 transition-colors shadow-lg shadow-primary/20 flex items-center">
                            <BrainCircuitIcon size={18} className="mr-2"/>
                            Run Analysis {selectedScopes.length > 0 ? `(${selectedScopes.length})` : '(All)'}
                          </button>
                       </div>
                    </div>
                 </div>
               </div>
             )}
        </div>

        {/* Right Sidebar */}
        <div className={`${isSidebarOpen ? 'w-96' : 'w-0'} bg-slate-900 border-l border-slate-800 flex flex-col transition-all duration-300 relative z-30 shadow-2xl`}>
           <div className="p-4 border-b border-slate-800 bg-slate-900 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center overflow-hidden whitespace-nowrap"><Calculator size={16} className="mr-2 flex-shrink-0"/> Takeoff Items</h3>
                <button className="text-primary hover:bg-primary/10 p-2 rounded transition-colors"><Download size={18}/></button>
              </div>
              
              {/* Sidebar Filter */}
              <div className="relative">
                 <Filter className="absolute left-3 top-2.5 text-slate-500" size={14}/>
                 <select 
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-primary appearance-none cursor-pointer hover:bg-slate-900 transition-colors"
                 >
                    <option value="All">All Divisions / Scopes</option>
                    <option value="Manual Takeoff">Manual Takeoff</option>
                    {CSI_DIVISIONS.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                    {availableCategories.filter(c => !CSI_DIVISIONS.includes(c) && c !== 'Manual Takeoff').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                 </select>
              </div>
           </div>
           
           <div className="flex-1 overflow-auto overflow-x-hidden">
             {filteredItems.length === 0 ? (
               <div className="p-8 text-center text-slate-500">
                 <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PenTool size={24} className="opacity-50"/>
                 </div>
                 <p className="text-sm font-medium text-white mb-1">No Items Found</p>
                 <p className="text-xs mb-4">Start takeoff or adjust filters.</p>
               </div>
             ) : (
               <div className="divide-y divide-slate-800">
                 {filteredItems.map((item) => (
                   <div key={item.id} className="p-4 hover:bg-slate-800 transition-colors group relative">
                     <div className="flex justify-between items-start mb-2">
                       <div className="min-w-0">
                         <div className={`text-xs font-bold uppercase tracking-wider mb-1 truncate ${item.category === 'Manual Takeoff' ? 'text-green-400' : 'text-primary'}`}>{item.category}</div>
                         <div className="text-sm text-white font-medium truncate" title={item.description}>{item.description}</div>
                       </div>
                       <button onClick={() => deleteItem(item.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                         <Trash2 size={14} />
                       </button>
                     </div>
                     
                     <div className="flex items-center gap-2 mb-2">
                        <span className="bg-slate-950 text-slate-300 px-2 py-0.5 rounded text-xs font-mono border border-slate-700 flex items-center">
                          {item.category === 'Manual Takeoff' ? <PenTool size={10} className="mr-1"/> : <CheckCircle2 size={10} className="mr-1"/>}
                          {item.quantity.toLocaleString()} {item.unit}
                        </span>
                     </div>

                     <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="relative">
                           <span className="absolute left-2 top-1.5 text-slate-500 text-xs">$</span>
                           <input 
                              type="number" 
                              placeholder="Unit Cost"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 pl-4 py-1 text-xs text-white focus:border-primary focus:outline-none"
                              value={item.unitCost || ''}
                              onChange={(e) => updateItemCost(item.id, parseFloat(e.target.value))}
                           />
                        </div>
                        <div className="flex items-center justify-end text-sm font-bold text-green-400 font-mono truncate">
                           {formatCurrency(item.totalCost)}
                        </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>

           {/* Footer Totals */}
           <div className="p-4 bg-slate-950 border-t border-slate-800 flex-shrink-0">
              <div className="flex justify-between items-center mb-1">
                 <span className="text-slate-400 text-sm">Total Items ({filteredItems.length})</span>
                 <span className="text-white font-mono">{filteredItems.length}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold">
                 <span className="text-white">Project Total</span>
                 <span className="text-primary">{formatCurrency(totalProjectCost)}</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ToolButton = ({ icon: Icon, label, active, onClick, color = 'text-white' }: any) => (
  <button 
    onClick={onClick}
    className={`p-3 rounded-lg flex items-center justify-center transition-all group relative ${
      active ? 'bg-slate-800 border-l-2 border-primary shadow-lg' : 'hover:bg-slate-800 text-slate-400'
    }`}
  >
    <Icon size={20} className={active ? color : ''} />
    <span className="absolute left-full ml-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 border border-slate-700 shadow-xl">
      {label}
    </span>
  </button>
);

const BrainCircuitIcon = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
        <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
        <path d="M6 18a4 4 0 0 1-1.97-2.8" />
        <path d="M17.97 15.2A4 4 0 0 1 18 18" />
    </svg>
);
