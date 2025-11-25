
import React, { useState, useEffect } from 'react';
import { getMaterialPricing, findLocalSuppliers, quickCalculate } from '../services/geminiService';
import { Loader2, Search, MapPin, DollarSign, Calculator, Globe } from 'lucide-react';
import { GroundingChunk } from '../types';

export const Estimator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pricing' | 'suppliers' | 'quickcalc'>('pricing');
  
  // Pricing State
  const [materialQuery, setMaterialQuery] = useState('');
  const [pricingResult, setPricingResult] = useState<{text: string, chunks?: GroundingChunk[]} | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  // Supplier State
  const [supplierQuery, setSupplierQuery] = useState('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [supplierResult, setSupplierResult] = useState<{text: string, chunks?: GroundingChunk[]} | null>(null);
  const [isSupplierLoading, setIsSupplierLoading] = useState(false);

  // Quick Calc State
  const [calcExpression, setCalcExpression] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [isCalcLoading, setIsCalcLoading] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location access denied")
      );
    }
  }, []);

  const handlePriceSearch = async () => {
    if (!materialQuery) return;
    setIsPricingLoading(true);
    try {
      const result = await getMaterialPricing(materialQuery);
      setPricingResult({ text: result.text || "No text returned", chunks: result.groundingChunks });
    } catch (e) {
      console.error(e);
    } finally {
      setIsPricingLoading(false);
    }
  };

  const handleSupplierSearch = async () => {
    if (!supplierQuery || !location) {
        if (!location) alert("Waiting for location access to find local suppliers.");
        return;
    }
    setIsSupplierLoading(true);
    try {
      const result = await findLocalSuppliers(supplierQuery, location.lat, location.lng);
      setSupplierResult({ text: result.text || "No text returned", chunks: result.groundingChunks });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSupplierLoading(false);
    }
  };

  const handleQuickCalc = async () => {
    if (!calcExpression) return;
    setIsCalcLoading(true);
    try {
      const res = await quickCalculate(calcExpression);
      setCalcResult(res || "");
    } catch (e) {
      console.error(e);
    } finally {
      setIsCalcLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Estimator & Sourcing</h1>
        <p className="text-slate-400 mt-1">Real-time market data and local supplier discovery.</p>
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl w-fit border border-slate-800">
        <button 
          onClick={() => setActiveTab('pricing')}
          className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'pricing' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Material Pricing
        </button>
        <button 
          onClick={() => setActiveTab('suppliers')}
          className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'suppliers' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Find Suppliers
        </button>
        <button 
          onClick={() => setActiveTab('quickcalc')}
          className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === 'quickcalc' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Quick Calc
        </button>
      </div>

      <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 min-h-[500px]">
        
        {/* TAB 1: PRICING */}
        {activeTab === 'pricing' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex gap-4">
              <input 
                type="text" 
                placeholder="E.g., 5/8 inch drywall sheets price 2024, 2x4 lumber cost per unit"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-5 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                value={materialQuery}
                onChange={(e) => setMaterialQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePriceSearch()}
              />
              <button 
                onClick={handlePriceSearch}
                disabled={isPricingLoading}
                className="bg-primary text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-sky-400 disabled:opacity-50 flex items-center transition-all"
              >
                {isPricingLoading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
              </button>
            </div>

            <div className="prose prose-invert max-w-none">
              {pricingResult ? (
                <div>
                   <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl mb-6 text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {pricingResult.text}
                   </div>
                   {pricingResult.chunks && pricingResult.chunks.length > 0 && (
                     <div>
                       <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Globe size={14}/> Verified Sources</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         {pricingResult.chunks.map((chunk, i) => (
                           chunk.web && chunk.web.uri && (
                             <a key={i} href={chunk.web.uri} target="_blank" rel="noreferrer" className="flex items-center p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-primary/50 hover:bg-slate-900 transition-all group">
                               <div className="bg-white rounded-sm p-0.5 mr-3 w-5 h-5 flex-shrink-0">
                                 <img src={`https://www.google.com/s2/favicons?domain=${chunk.web.uri}`} alt="" className="w-full h-full" />
                               </div>
                               <span className="text-primary group-hover:underline text-sm truncate font-medium">
                                 {chunk.web.title || chunk.web.uri}
                               </span>
                             </a>
                           )
                         ))}
                       </div>
                     </div>
                   )}
                </div>
              ) : (
                <div className="text-center text-slate-600 py-20">
                  <DollarSign size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Use Google Search Grounding to find live material costs.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SUPPLIERS */}
        {activeTab === 'suppliers' && (
          <div className="space-y-8 animate-fade-in">
             <div className="flex gap-4">
              <input 
                type="text" 
                placeholder="E.g., Lumber yards nearby, Concrete suppliers, HVAC distributors"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-5 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-secondary focus:border-transparent focus:outline-none"
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSupplierSearch()}
              />
              <button 
                onClick={handleSupplierSearch}
                disabled={isSupplierLoading || !location}
                className="bg-secondary text-white px-8 py-3 rounded-xl font-bold hover:bg-orange-500 disabled:opacity-50 flex items-center transition-all"
              >
                {isSupplierLoading ? <Loader2 className="animate-spin" /> : <MapPin size={20} />}
              </button>
            </div>
            
             <div className="prose prose-invert max-w-none">
              {supplierResult ? (
                <div>
                   <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl mb-6 text-slate-200 whitespace-pre-wrap">
                      {supplierResult.text}
                   </div>
                   {supplierResult.chunks && supplierResult.chunks.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {supplierResult.chunks.map((chunk, i) => (
                         chunk.maps && (
                           <div key={i} className="bg-slate-950 border border-slate-800 p-5 rounded-xl hover:border-secondary/50 transition-all group">
                              <h5 className="font-bold text-white text-lg mb-1">{chunk.maps.title}</h5>
                              {chunk.maps.uri && (
                                <a href={chunk.maps.uri} target="_blank" rel="noreferrer" className="text-sm text-secondary hover:underline flex items-center mb-3">View on Maps <MapPin size={12} className="ml-1"/></a>
                              )}
                              {chunk.maps.placeAnswerSources?.reviewSnippets?.[0] && chunk.maps.placeAnswerSources.reviewSnippets[0].snippet && (
                                <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-3">"{chunk.maps.placeAnswerSources.reviewSnippets[0].snippet}"</p>
                              )}
                           </div>
                         )
                       ))}
                     </div>
                   )}
                </div>
              ) : (
                <div className="text-center text-slate-600 py-20">
                  <MapPin size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Locate suppliers instantly with Google Maps integration.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QUICK CALC */}
        {activeTab === 'quickcalc' && (
          <div className="space-y-10 max-w-2xl mx-auto text-center pt-10 animate-fade-in">
            <div>
                <Calculator size={64} className="mx-auto text-primary mb-6 drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]" />
                <h3 className="text-2xl font-bold text-white mb-2">Rapid Construction Math</h3>
                <p className="text-slate-400">Powered by Gemini 2.5 Flash Lite for instant answers.</p>
            </div>
            
            <div className="relative">
              <input 
                type="text" 
                value={calcExpression}
                onChange={(e) => setCalcExpression(e.target.value)}
                placeholder="E.g., How many 4x8 sheets for 1200 sq ft wall area?"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-6 py-5 text-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary focus:outline-none shadow-inner"
                onKeyDown={(e) => e.key === 'Enter' && handleQuickCalc()}
              />
              <button 
                 onClick={handleQuickCalc}
                 className="absolute right-3 top-3 bottom-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl px-6 font-medium transition-colors border border-slate-700"
              >
                Calculate
              </button>
            </div>

            {isCalcLoading && <Loader2 className="animate-spin mx-auto text-slate-500" size={32} />}
            
            {calcResult && (
              <div className="bg-slate-950 border border-green-500/30 text-green-400 font-mono p-8 rounded-2xl text-left shadow-[0_0_30px_rgba(34,197,94,0.1)] mt-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-20"><Calculator size={100}/></div>
                <span className="block text-xs text-slate-500 mb-3 tracking-widest uppercase">Result</span>
                <div className="whitespace-pre-wrap text-lg font-bold relative z-10">{calcResult}</div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};