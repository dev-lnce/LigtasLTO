import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import { BRANCHES } from '../data/branches';

const CATEGORIES = ['License Renewal', 'MV Registration', 'MVIR', 'Student Permit'];

// Mock result data for different transactions
const getMockChecklist = (type: string, hasImage: boolean) => {
  if (!hasImage) return [];
  if (type === 'License Renewal') {
     return [
       { id: 'name', field: 'Pangalan at Detalye', emoji: '👤', status: 'ok' },
       { id: 'medcert', field: 'Medical Certificate', emoji: '🏥', status: 'missing' },
       { id: 'signature', field: 'Pirma', emoji: '✍️', status: 'ok' }
     ];
  }
  return [
     { id: 'name', field: 'Pangalan at Detalye', emoji: '👤', status: 'ok' },
     { id: 'orcr', field: 'Lumang OR/CR', emoji: '📄', status: 'ok' },
     { id: 'insurance', field: 'TPL Insurance', emoji: '🛡️', status: 'ok' }
  ];
};

export function PreCheck() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeCategory, setActiveCategory] = useState('License Renewal');
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'results'>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
        const url = URL.createObjectURL(e.target.files[0]);
        setSelectedImage(url);
        setScanState('idle');
     }
  };

  const handleScan = () => {
     setScanState('scanning');
     setTimeout(() => {
        setScanState('results');
     }, 2500);
  };

  const resetForm = () => {
     setSelectedImage(null);
     setScanState('idle');
  };

  const checklistData = getMockChecklist(activeCategory, true);
  const isAllOk = checklistData.every(item => item.status === 'ok');

  const packingItems = (BRANCHES[0]?.communityRequirements7d || []).slice().sort((a, b) => {
    // Persona 2C: actively-required items first (missing/red), then OK items (green).
    if (a.status === b.status) return 0;
    return a.status === 'missing' ? -1 : 1;
  });

  return (
    <>
      <header className="px-6 pb-4 pt-2">
        <motion.h1 className="text-2xl font-black tracking-tight text-on-surface dark:text-slate-100">Form Pre-Check</motion.h1>
        <motion.p className="text-[12px] font-medium mt-1 leading-relaxed max-w-[90%] text-on-surface-variant dark:text-slate-400">
          I-scan bago pumila para makatipid ng oras. {/* FIX 4: Ensure text tokens have dark variants. */}
        </motion.p>
      </header>

      {/* Transaction Type Selector */}
      <div className="pl-6 mb-6 flex gap-2.5 overflow-x-auto pb-2 pr-6 relative scrollbar-hide">
        <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l pointer-events-none z-10 ${isDark ? 'from-slate-900' : 'from-gray-50'}`} />
        {CATEGORIES.map((category) => (
          <motion.button 
            key={category} 
            onClick={() => { setActiveCategory(category); if(selectedImage) setScanState('idle'); }} 
            className={`whitespace-nowrap px-4 py-2.5 rounded-full text-[13px] font-extrabold transition-all flex-shrink-0 border ${
              activeCategory === category
                ? 'bg-[#E63946] text-white border-[#E63946] shadow-lg shadow-[#E63946]/20'
                : 'bg-surface-container-lowest dark:bg-slate-800 text-on-surface-variant dark:text-slate-400 border-outline-variant/10 dark:border-slate-700/30 hover:bg-surface-container-low dark:hover:bg-slate-700'
            }`} /* FIX 4: Replace custom dark backgrounds with proper dark variants. */
          >
            <span className="inline-flex items-center gap-2">
              {category}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Upload Zone */}
      <div className="px-6 mb-6">
        <input 
          type="file" 
          accept="image/jpeg, image/png" 
          capture="environment" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange} 
        />
        
        <AnimatePresence mode="wait">
          {!selectedImage ? (
            <motion.div 
               key="upload"
               initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
               onClick={() => fileInputRef.current?.click()}
               className={`rounded-[24px] p-8 border-2 border-dashed flex flex-col items-center text-center cursor-pointer transition-colors group ${isDark ? 'bg-slate-800 border-slate-600 hover:bg-slate-700' : 'bg-gray-100 border-gray-300 hover:bg-gray-200'}`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border ${isDark ? 'bg-slate-800 border-white/5 text-slate-400' : 'bg-white border-gray-200'}`}>
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" } as any}>description</span>
              </div>
              <h2 className={`font-bold text-[17px] mb-2 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>I-upload ang inyong Form</h2>
              <p className={`text-[11px] font-medium leading-relaxed max-w-[85%] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Kuhanan ng malinaw na litrato ang iyong form. Hindi ise-save ang iyong larawan sa server.</p>
              <div className={`mt-5 px-5 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 transition-colors ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" } as any}>photo_camera</span> Buksan ang Camera
              </div>
            </motion.div>
          ) : (
            <motion.div 
               key="preview"
               initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
               className={`rounded-[24px] p-2 border shadow-sm relative ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}
            >
               <img src={selectedImage} alt="Form preview" className="w-full h-48 object-cover rounded-[18px]" />
               <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={resetForm} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                     <span className="material-symbols-outlined text-lg">close</span>
                  </button>
               </div>
               
               {scanState === 'idle' && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-[18px] flex items-center justify-center p-6">
                     <button 
                       onClick={handleScan}
                       className="w-full max-w-[200px] bg-[#E63946] text-white py-3.5 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(230,57,70,0.4)] hover:scale-105 transition-transform"
                     >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" } as any}>fact_check</span> I-scan Ngayon
                     </button>
                  </div>
               )}
               
               {scanState === 'scanning' && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[18px] flex flex-col items-center justify-center p-6 text-white text-center">
                     <div className="w-12 h-12 border-4 border-white/20 border-t-[#E63946] rounded-full animate-spin mb-4" />
                     <h3 className="font-bold text-sm mb-1">Sinusuri ang dokumento...</h3>
                     <p className="text-[10px] opacity-70">Gumagamit ng AI Vision. Sandali lamang.</p>
                  </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Region */}
      <AnimatePresence>
        {scanState === 'results' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="px-6 pb-24">
            <h3 className={`font-bold text-[15px] mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Resulta ng Pag-scan</h3>
            
            <div className="flex flex-col gap-2.5 mb-6">
              {checklistData.map((item, index) => (
                <motion.div 
                   key={item.id} 
                   initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.15 }}
                   className={`rounded-2xl p-3.5 border flex items-center justify-between ${isDark ? 'bg-slate-800 border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm shadow-inner ${isDark ? 'bg-[#0A1626] border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                      <span className="material-symbols-outlined text-base">
                        {item.id === 'medcert'
                          ? 'medical_services'
                          : item.id === 'signature'
                            ? 'draw'
                            : item.id === 'insurance'
                              ? 'shield'
                              : item.id === 'orcr'
                                ? 'description'
                                : 'person'}
                      </span>
                    </div>
                    <span className={`font-semibold text-[13px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.field}</span>
                  </div>
                  <div>
                    {item.status === 'ok' && <div className={`px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 uppercase tracking-wider border ${isDark ? 'bg-green-900 text-green-300 border-[#10B981]/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" } as any}>check_circle</span> OK</div>}
                    {item.status === 'missing' && <div className={`px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 uppercase tracking-wider border ${isDark ? 'bg-red-950 text-red-300 border-[#E63946]/30' : 'bg-red-50 text-red-600 border-red-200'}`}><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" } as any}>error</span> Kulang!</div>}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Scenario 9: Branch Specific Warning Section */}
            <div className={`mt-5 border rounded-2xl p-4 mb-5 ${isDark ? 'bg-amber-950/60 border-amber-700' : 'bg-amber-50 border-amber-200 shadow-sm'}`}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" } as any}>info</span>
                  <h4 className={`text-[13px] font-extrabold ${isDark ? 'text-[#F59E0B]' : 'text-amber-700'}`}>Dagdag na Paalala</h4>
                </div>
              </div>

              <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 mb-3">
                Mga hiningi sa ibang tao ngayon sa branch na ito
              </div>

              {packingItems.length ? (
                <div className="space-y-2">
                  {packingItems.map((r) => {
                    const isOk = r.status === 'ok';
                    return (
                      <div
                        key={r.tag}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant/10 dark:border-slate-700/30"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`material-symbols-outlined text-[28px] flex-shrink-0 ${
                              isOk ? 'text-emerald-500 dark:text-emerald-400' : 'text-error dark:text-red-400'
                            }`}
                            style={{ fontVariationSettings: "'FILL' 1" } as any}
                          >
                            {isOk ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-on-surface dark:text-slate-100 truncate">{r.labelFil}</div>
                            <div className={`text-[11px] font-extrabold ${isOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-error dark:text-red-400'} whitespace-nowrap`}>
                              {isOk ? 'OK naman daw ngayon' : 'HINIHINGI NGAYON'}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`px-3 py-1 rounded-full text-[11px] font-extrabold border whitespace-nowrap ${
                            isOk
                              ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-500/20 dark:border-emerald-800/30'
                              : 'bg-red-500/10 text-error dark:bg-red-950/60 dark:text-red-300 border-red-500/20 dark:border-red-800/30'
                          }`}
                        >
                          {r.count} nag-ulat
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400">Walang hiningi ngayon.</div>
              )}
            </div>

            {isAllOk ? (
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                 <div className={`border rounded-2xl p-4 flex flex-col items-center text-center gap-2 mb-4 ${isDark ? 'bg-green-950 border-green-800' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="w-12 h-12 bg-[#10B981] rounded-full flex items-center justify-center text-white mb-1 shadow-lg shadow-[#10B981]/40">
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" } as any}>check</span>
                    </div>
                    <h4 className="text-[#10B981] font-extrabold text-[15px]">Handa na ang Form!</h4>
                    <p className={`text-[11px] font-medium leading-relaxed px-4 ${isDark ? 'text-[#10B981]/80' : 'text-emerald-700'}`}>Kumpleto ang mga kinakailangang detalye base sa aming pagsusuri.</p>
                 </div>
                 <button 
                   onClick={() => navigate('/queue')}
                   className="w-full bg-[#10B981] hover:bg-[#059669] text-white py-4 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98]"
                 >
                   Pumunta sa Timer <span className="material-symbols-outlined text-xl">arrow_forward</span>
                 </button>
               </motion.div>
            ) : (
               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                 <div className={`border rounded-2xl p-4 mb-4 flex items-start gap-3 ${isDark ? 'bg-red-950 border-red-800' : 'bg-red-50 border-red-200'}`}>
                   <div className={`p-1.5 rounded-full mt-0.5 flex-shrink-0 ${isDark ? 'bg-[#E63946]/20' : 'bg-red-100'}`}>
                     <span className="material-symbols-outlined text-lg text-[#E63946]">cancel</span>
                   </div>
                   <div>
                     <h4 className="text-[#E63946] font-extrabold text-[14px] mb-1">Hindi pa Handa ang Form</h4>
                     <p className={`text-[11px] font-medium leading-relaxed ${isDark ? 'text-[#E63946]/80' : 'text-red-700'}`}>May mga nakitang kulang na mahalagang detalye. Punan muna ang mga ito bago pumila sa LTO para iwas-abala.</p>
                   </div>
                 </div>
                 <button 
                   onClick={() => setScanState('idle')}
                   className={`w-full py-4 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${isDark ? 'bg-slate-800 border-white/20 text-white hover:bg-slate-700' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'}`}
                 >
                   <span className="material-symbols-outlined text-xl">refresh</span> I-scan Ulit
                 </button>
               </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
