import React, { useState } from 'react';
import { analyzeSiteVideo } from '../services/geminiService';
import { fileToBase64 } from '../services/utils';
import { Video, Upload, Loader2, PlayCircle, AlertTriangle } from 'lucide-react';

export const SiteVideo: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Identify any safety hazards and construction progress shown in this video.');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.size > 20 * 1024 * 1024) {
        alert("For this browser demo, please use videos under 20MB.");
        return;
      }
      setFile(f);
      setVideoUrl(URL.createObjectURL(f));
      setAnalysis('');
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await analyzeSiteVideo(base64, file.type, prompt);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Try a shorter video clip.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
       <header>
        <h1 className="text-3xl font-bold text-white">Site Video Intelligence</h1>
        <p className="text-slate-400 mt-1">Upload walkthroughs to automatically detect progress and hazards.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
           <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center relative group border border-slate-800 shadow-2xl">
             {videoUrl ? (
               <video src={videoUrl} controls className="w-full h-full" />
             ) : (
               <div className="text-slate-700 flex flex-col items-center">
                 <Video size={64} className="mb-4 opacity-50" />
                 <span className="font-medium text-slate-500">No video selected</span>
               </div>
             )}
             
             {!videoUrl && (
                <label className="absolute inset-0 cursor-pointer flex items-center justify-center">
                   <div className="bg-slate-800/80 text-white px-6 py-3 rounded-xl backdrop-blur-sm border border-slate-700 hover:bg-slate-700 transition-colors flex items-center">
                       <Upload size={20} className="mr-2" /> Upload Video
                   </div>
                   <input type="file" accept="video/*" onChange={handleFile} className="hidden" />
                </label>
             )}
             {videoUrl && (
                <label className="absolute top-4 right-4 cursor-pointer z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/50 text-white p-2 rounded-lg hover:bg-black/80 backdrop-blur-md">
                        <Upload size={20} />
                    </div>
                    <input type="file" accept="video/*" onChange={handleFile} className="hidden" />
                </label>
             )}
           </div>

           <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
             <label className="block text-sm font-bold text-slate-300 mb-3">Analysis Goal</label>
             <div className="flex gap-3">
               <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
               />
               <button 
                 onClick={handleAnalyze}
                 disabled={isLoading || !file}
                 className="bg-primary text-slate-900 px-6 py-3 rounded-xl text-sm font-bold hover:bg-sky-400 disabled:opacity-50 flex items-center transition-all shadow-lg shadow-primary/20"
               >
                 {isLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <PlayCircle className="mr-2" size={16} />}
                 Analyze
               </button>
             </div>
           </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 h-[500px] overflow-auto shadow-xl relative">
          <h3 className="font-bold text-white mb-6 flex items-center text-lg">
            <Video size={20} className="mr-3 text-primary" /> Gemini Analysis
          </h3>
          {analysis ? (
             <div className="prose prose-invert prose-sm max-w-none">
               <div className="whitespace-pre-wrap leading-relaxed text-slate-300">{analysis}</div>
             </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 pb-10">
              <AlertTriangle size={48} className="mb-4 opacity-20" />
              <p className="text-center max-w-xs">Analysis results will appear here. Try asking about safety compliance or material staging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};