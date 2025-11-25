import React, { useState } from 'react';
import { generateConceptImage, editPlanImage, ensureApiKey } from '../services/geminiService';
import { ImageAspectRatio, ImageSize } from '../types';
import { Loader2, ImagePlus, Wand2, Download, Upload, LayoutTemplate } from 'lucide-react';
import { fileToBase64 } from '../services/utils';

export const Visualizer: React.FC = () => {
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  
  // Generation State
  const [genPrompt, setGenPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(ImageAspectRatio.LANDSCAPE_16_9);
  const [size, setSize] = useState<ImageSize>(ImageSize.K1);
  const [genImage, setGenImage] = useState<string | null>(null);
  const [isGenLoading, setIsGenLoading] = useState(false);

  // Edit State
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);

  const handleGenerate = async () => {
    if (!genPrompt) return;
    setIsGenLoading(true);
    try {
      await ensureApiKey();
      const base64 = await generateConceptImage(genPrompt, aspectRatio, size);
      if (base64) setGenImage(base64);
    } catch (e) {
      console.error(e);
      alert("Failed to generate image. Ensure you have a paid API key selected.");
    } finally {
      setIsGenLoading(false);
    }
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditFile(file);
      setEditPreview(URL.createObjectURL(file));
      setEditedImage(null);
    }
  };

  const handleEdit = async () => {
    if (!editFile || !editPrompt) return;
    setIsEditLoading(true);
    try {
      const base64 = await fileToBase64(editFile);
      const result = await editPlanImage(base64, editFile.type, editPrompt);
      if (result) setEditedImage(result);
    } catch (e) {
      console.error(e);
      alert("Failed to edit image.");
    } finally {
      setIsEditLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-white">Visualizer Studio</h1>
           <p className="text-slate-400 mt-1">Generate concepts or modify plans with AI.</p>
        </div>
        <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex text-sm font-medium">
          <button 
            onClick={() => setMode('generate')}
            className={`px-5 py-2 rounded-lg transition-all ${mode === 'generate' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Generate Concept
          </button>
          <button 
            onClick={() => setMode('edit')}
            className={`px-5 py-2 rounded-lg transition-all ${mode === 'edit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Edit Plan
          </button>
        </div>
      </div>

      {mode === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl h-fit">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-3">Prompt</label>
              <textarea 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 h-32 resize-none text-white focus:ring-2 focus:ring-primary focus:outline-none placeholder-slate-600"
                placeholder="A modern brutalist office building lobby with concrete walls and warm lighting..."
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3">Aspect Ratio</label>
                <select 
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value as ImageAspectRatio)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none"
                >
                  {Object.values(ImageAspectRatio).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3">Size</label>
                <select 
                  value={size} 
                  onChange={(e) => setSize(e.target.value as ImageSize)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none"
                >
                  {Object.values(ImageSize).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenLoading || !genPrompt}
              className="w-full bg-primary text-slate-900 py-3 rounded-xl font-bold hover:bg-sky-400 disabled:opacity-50 flex items-center justify-center transition-all shadow-lg shadow-primary/20"
            >
              {isGenLoading ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />} 
              Generate (Gemini 3 Pro)
            </button>
          </div>

          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center min-h-[500px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 z-0"></div>
            {genImage ? (
              <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
                  <img src={genImage} alt="Generated" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
              </div>
            ) : (
              <div className="text-slate-700 flex flex-col items-center relative z-10">
                <ImagePlus size={64} className="mb-4 opacity-50" />
                <span className="font-medium">Generated visualization area</span>
              </div>
            )}
            {genImage && (
              <a href={genImage} download="concept.png" className="absolute bottom-6 right-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition-colors z-20 border border-white/10">
                <Download size={24} />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer relative h-80 group">
                <input type="file" accept="image/*" onChange={handleEditFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                {editPreview ? (
                  <img src={editPreview} alt="Preview" className="h-full object-contain relative z-10 rounded" />
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <Upload size={40} className="text-secondary mb-3 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">Upload plan to edit</span>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <label className="block text-sm font-bold text-slate-300 mb-3">Edit Instruction</label>
                <div className="flex gap-3">
                  <input 
                    type="text"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="E.g., Add a swimming pool in the backyard"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                  <button 
                    onClick={handleEdit}
                    disabled={isEditLoading || !editFile || !editPrompt}
                    className="bg-secondary text-white px-6 rounded-xl font-bold hover:bg-orange-500 disabled:opacity-50 flex items-center justify-center"
                  >
                    {isEditLoading ? <Loader2 className="animate-spin" /> : 'Edit'}
                  </button>
                </div>
              </div>
           </div>

           <div className="bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center h-[500px] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950 z-0"></div>
              {editedImage ? (
                <div className="relative z-10 p-4 w-full h-full flex items-center justify-center">
                    <img src={editedImage} alt="Edited Result" className="max-w-full max-h-full object-contain rounded shadow-2xl" />
                </div>
              ) : (
                <div className="text-slate-700 flex flex-col items-center relative z-10">
                   <LayoutTemplate size={64} className="mb-4 opacity-50"/>
                   <span className="font-medium">Edited plan will appear here</span>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};