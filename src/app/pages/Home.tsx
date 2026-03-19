import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MapPin, CreditCard, Clock, AlertTriangle, FileText, AlertCircle, ChevronRight, X, BarChart3, ChevronRightCircle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import { toast, Toaster } from 'sonner';

const BRANCHES = [
  { id: 'lto-diliman', name: 'LTO Diliman District', address: 'East Avenue, Quezon City', hasCards: true, waitTime: '2-3 Oras', grade: 'C' as const, isPuno: true },
  { id: 'lto-novaliches', name: 'LTO Novaliches', address: 'Robinsons Novaliches, QC', hasCards: false, waitTime: '45 Minuto', grade: 'A' as const, isPuno: false }
];

export function Home() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [isLocationModalOpen, setLocationModalOpen] = useState(false);
  const [isAlertsOpen, setAlertsOpen] = useState(false);
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(true);
  const [isChartOpen, setChartOpen] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(true);
  const [isPunoAlertDismissed, setPunoAlertDismissed] = useState(false);

  // Stale check for the dot (mocking < 10 mins as true for now, but keeping the logic visible)
  const isDataStale = false;

  const handleAlertsClick = () => {
    setHasUnreadAlerts(false);
    setAlertsOpen(true);
  };

  const handleQuickStatClick = (type: string) => {
    switch(type) {
      case 'plastic':
        navigate('/branches?filter=may-plastic');
        break;
      case 'wait':
        setChartOpen(true);
        break;
      case 'flagged':
        navigate('/branches?filter=may-flag');
        break;
      case 'reports':
        toast.success("May 842 ulat na galing sa mga kapwa motorista ngayong araw!");
        break;
    }
  };

  return (
    <>
      <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />
      {/* Header */}
      <header className="px-6 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border shadow-sm ${isDark ? 'bg-[#162A45] border-white/10' : 'bg-white border-gray-200'}`}>
            <span className="text-xl">🚦</span>
          </div>
          <div>
            <motion.h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              LigtasLTO
            </motion.h1>
            <button 
              onClick={() => setLocationModalOpen(true)}
              className={`text-[11px] flex items-center gap-1 mt-0.5 font-bold uppercase tracking-wider transition-colors hover:opacity-70 ${isDark ? 'text-blue-200/70 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <MapPin size={10} /> Quezon City, NCR
            </button>
          </div>
        </div>
        <motion.button 
          onClick={handleAlertsClick}
          whileTap={{ scale: 0.9 }}
          className={`p-2.5 rounded-full relative border shadow-md transition-colors ${isDark ? 'bg-[#162A45] border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-100'}`}
        >
          <Bell size={18} />
          {hasUnreadAlerts && (
            <span className={`absolute top-2.5 right-2.5 w-2 h-2 bg-[#E63946] rounded-full border ${isDark ? 'border-[#162A45]' : 'border-white'}`}></span>
          )}
        </motion.button>
      </header>

      {/* PUNO Alert (Scenario 6) */}
      <AnimatePresence>
        {!isPunoAlertDismissed && BRANCHES.some(b => b.isPuno) && (
           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 mb-4 overflow-hidden">
              <div className="bg-[#b32b37] text-white p-3.5 rounded-2xl flex items-start gap-3 shadow-lg relative border border-white/20">
                 <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-white" />
                 <div>
                    <h4 className="font-black text-[14px] uppercase tracking-widest mb-1 text-white">May PUNO na Sangay</h4>
                    <p className="text-xs font-semibold opacity-90 leading-relaxed max-w-[90%]">Ang 1 sangay malapit sa'yo ay ubos na ang queue numbers ngayong araw.</p>
                 </div>
                 <button onClick={() => setPunoAlertDismissed(true)} className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={14} /></button>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Banner */}
      <motion.div className="mx-6 mb-6 rounded-[24px] bg-gradient-to-br from-[#E63946] to-[#b32b37] p-6 relative overflow-hidden shadow-lg shadow-[#E63946]/20">
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/20 px-2 py-1 rounded-full backdrop-blur-md">
           <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor] ${isDataStale ? 'bg-[#F59E0B] text-[#F59E0B]' : 'bg-[#10B981] text-[#10B981]'}`} />
           <span className="text-[9px] font-bold text-white uppercase tracking-wider">{isDataStale ? 'Stale' : 'Live'}</span>
        </div>
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/10 rounded-full blur-xl pointer-events-none" />
        <div className="relative z-10 mt-4">
          <h2 className="text-2xl font-black text-white leading-tight mb-2 tracking-tight">Alamin bago pumula sa LTO</h2>
          <p className="text-white/90 text-sm mb-5 font-medium leading-relaxed max-w-[85%]">Tingnan ang haba ng pila at availability ng cards bago bumiyahe.</p>
          <button 
            onClick={() => navigate('/branches')}
            className="bg-white text-[#E63946] px-5 py-2.5 rounded-full text-sm font-extrabold shadow-md hover:scale-105 transition-transform flex items-center gap-2 active:scale-95"
          >
            Tingnan ang Malapit <ChevronRight size={16} strokeWidth={3} />
          </button>
        </div>
      </motion.div>

      {/* 2x2 Stats Grid */}
      <div className="px-6 mb-6 grid grid-cols-2 gap-3">
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => handleQuickStatClick('plastic')}
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between h-[100px] text-left transition-colors ${isDark ? 'bg-[#162A45] border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-2 text-[#10B981]"><CreditCard size={16} /><span className="text-xs font-bold uppercase tracking-wider opacity-80">Cards Available</span></div>
          <div className="text-2xl font-black text-[#10B981]">12 <span className="text-xs font-bold opacity-60 ml-0.5">Sangay</span></div>
        </motion.button>
        
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => handleQuickStatClick('wait')}
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between h-[100px] text-left transition-colors ${isDark ? 'bg-[#162A45] border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-2 text-[#F59E0B]"><Clock size={16} /><span className="text-xs font-bold uppercase tracking-wider opacity-80">Avg Wait Today</span></div>
          <div className="text-2xl font-black text-[#F59E0B]">2.5 <span className="text-xs font-bold opacity-60 ml-0.5">Oras</span></div>
        </motion.button>
        
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => handleQuickStatClick('flagged')}
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between h-[100px] text-left transition-colors ${isDark ? 'bg-[#162A45] border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-2 text-[#E63946]"><AlertTriangle size={16} /><span className="text-xs font-bold uppercase tracking-wider opacity-80">Flagged</span></div>
          <div className="text-2xl font-black text-[#E63946]">3 <span className="text-xs font-bold opacity-60 ml-0.5">Sangay</span></div>
        </motion.button>
        
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => handleQuickStatClick('reports')}
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between h-[100px] text-left transition-colors ${isDark ? 'bg-[#162A45] border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
        >
          <div className={`flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}><FileText size={16} /><span className="text-xs font-bold uppercase tracking-wider opacity-60">Total Reports</span></div>
          <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>842 <span className="text-xs font-bold opacity-50 ml-0.5">Ulat</span></div>
        </motion.button>
      </div>

      {/* Anomaly Alert Card */}
      <AnimatePresence>
        {showAnomaly && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, padding: 0, margin: 0 }}
            drag="x"
            dragConstraints={{ left: -100, right: 0 }}
            onDragEnd={(e, { offset }) => {
              if (offset.x < -50) setShowAnomaly(false);
            }}
            className={`mx-6 mb-8 border rounded-[20px] p-4 flex gap-4 items-start cursor-grab active:cursor-grabbing ${isDark ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30' : 'bg-amber-50 border-amber-200'}`}
          >
            <div className={`p-2.5 rounded-full mt-0.5 ${isDark ? 'bg-[#F59E0B]/20' : 'bg-amber-100'}`}><AlertCircle size={20} className="text-[#F59E0B]" /></div>
            <div className="flex-1" onClick={() => navigate('/branches')}>
              <h3 className="text-[#F59E0B] font-extrabold text-sm mb-1">Posibleng Fixer — LTO Quezon City</h3>
              <p className={`${isDark ? 'text-[#F59E0B]/80' : 'text-amber-800'} text-xs font-medium leading-relaxed mb-2`}>
                May 12 na magkakasunod na ulat ng mga fixer na nag-aalok ng mabilisang proseso sa labas ng main gate.
              </p>
              <button className={`text-[10px] font-bold uppercase underline underline-offset-2 ${isDark ? 'text-[#F59E0B]' : 'text-amber-700'}`}>
                +2 PANG ANOMALY
              </button>
            </div>
            <div className="h-full flex items-center justify-center opacity-30 px-1 pt-12">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-[#F59E0B]' : 'text-amber-800'} transition-opacity`}>SwIPE \u2190</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Branch List */}
      <div className="px-6 mb-8">
        <div className="flex justify-between items-end mb-4">
           <h2 className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Mga Malapit na Sangay</h2>
           <button onClick={() => navigate('/branches')} className={`text-[11px] font-bold tracking-wider uppercase transition-colors flex items-center gap-1 ${isDark ? 'text-[#E63946] hover:text-[#b32b37]' : 'text-[#E63946] hover:text-[#b32b37]'}`}>
              See All <ChevronRightCircle size={12} />
           </button>
        </div>
        {BRANCHES.map((branch) => {
          const gradeColors = {
            A: isDark ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30' : 'text-[#10B981] bg-emerald-50 border-emerald-200',
            B: isDark ? 'text-[#a7f3d0] bg-[#a7f3d0]/10 border-[#a7f3d0]/30' : 'text-emerald-500 bg-emerald-50 border-emerald-200',
            C: isDark ? 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30' : 'text-amber-500 bg-amber-50 border-amber-200',
            D: isDark ? 'text-[#fb923c] bg-[#fb923c]/10 border-[#fb923c]/30' : 'text-orange-500 bg-orange-50 border-orange-200',
            F: isDark ? 'text-[#E63946] bg-[#E63946]/10 border-[#E63946]/30' : 'text-red-500 bg-red-50 border-red-200',
          };
          return (
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/branches')}
              key={branch.id} 
              className={`w-full text-left rounded-[20px] p-5 mb-4 border flex items-center justify-between shadow-sm transition-colors ${isDark ? 'bg-[#162A45] border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              <div className="flex-1 pr-4">
                <h3 className={`font-extrabold text-[15px] mb-1 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{branch.name}</h3>
                <p className={`text-[11px] font-medium flex items-center gap-1 mb-3 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}><MapPin size={10} /> {branch.address}</p>
                <div className="flex flex-wrap gap-2">
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${branch.hasCards ? (isDark ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200') : (isDark ? 'bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30' : 'bg-red-50 text-red-600 border-red-200')}`}>
                    <CreditCard size={10} /> {branch.hasCards ? 'MAY PLASTIC CARDS' : 'WALANG CARDS'}
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${isDark ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                    <Clock size={10} /> {branch.waitTime}
                  </div>
                </div>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-inner ${gradeColors[branch.grade]}`}>
                <span className="text-2xl font-black">{branch.grade}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Location Modal */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[3rem]"
              onClick={() => setLocationModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm rounded-[24px] p-6 shadow-2xl border ${isDark ? 'bg-[#0D1F35] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-black tracking-tight text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Pumili ng Lokasyon</h3>
                <button onClick={() => setLocationModalOpen(false)} className={`p-1.5 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}><X size={16} /></button>
              </div>
              <div className="flex flex-col gap-2">
                {['Quezon City, NCR', 'Manila City, NCR', 'Makati City, NCR'].map(city => (
                  <button key={city} onClick={() => { setLocationModalOpen(false); toast.success(`Lokasyon nailipat sa ${city}`); }} className={`text-left px-4 py-3 rounded-xl font-bold text-sm transition-colors ${isDark ? 'hover:bg-white/5 text-white' : 'hover:bg-gray-50 text-gray-900'} ${city === 'Quezon City, NCR' ? (isDark ? 'bg-[#E63946]/20 text-[#E63946]' : 'bg-red-50 text-red-600') : ''}`}>
                    {city}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alerts Drawer */}
      <AnimatePresence>
        {isAlertsOpen && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[3rem]"
              onClick={() => setAlertsOpen(false)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`relative w-full h-[70%] rounded-t-[32px] p-6 shadow-2xl border-t ${isDark ? 'bg-[#0D1F35] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="w-12 h-1.5 bg-gray-400/30 rounded-full mx-auto mb-6" />
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-black tracking-tight text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Mga Abiso</h3>
                <button onClick={() => setAlertsOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}><X size={18} /></button>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto pb-10">
                <div className={`p-4 rounded-[20px] border flex items-start gap-3 ${isDark ? 'bg-[#162A45] border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className={`p-2 rounded-full ${isDark ? 'bg-[#E63946]/20 text-[#E63946]' : 'bg-red-100 text-red-600'}`}><AlertTriangle size={18} /></div>
                  <div>
                     <h4 className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Mataas na Dami ng Tao - QC</h4>
                     <p className={`text-xs font-medium leading-relaxed ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Lagpas 4 na oras na ang avg wait time sa LTO Novaliches. Iwasan muna kung maaari.</p>
                     <p className={`text-[10px] mt-2 font-bold ${isDark ? 'text-blue-200/30' : 'text-gray-400'}`}>12 MINS AGO</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hourly Chart Modal */}
      <AnimatePresence>
        {isChartOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[3rem]"
              onClick={() => setChartOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full rounded-[24px] p-6 shadow-2xl border ${isDark ? 'bg-[#0D1F35] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className={`font-black tracking-tight text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Average Wait Time</h3>
                   <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Lahat ng Sangay Ngayon</p>
                </div>
                <button onClick={() => setChartOpen(false)} className={`p-1.5 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}><X size={16} /></button>
              </div>
              <div className="h-40 flex items-end justify-between gap-2 border-b border-dashed pb-2 mb-4">
                 {[40, 60, 80, 100, 60, 30].map((h, i) => (
                    <div key={i} className="w-8 bg-[#F59E0B] rounded-t-md relative group transition-all hover:brightness-110" style={{ height: `${h}%` }}>
                       <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded shadow-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white pointer-events-none`}>{h/20}h</div>
                    </div>
                 ))}
              </div>
              <div className="flex justify-between px-2">
                 <span className={`text-[10px] font-bold ${isDark ? 'text-blue-200/40' : 'text-gray-400'}`}>8AM</span>
                 <span className={`text-[10px] font-bold ${isDark ? 'text-blue-200/40' : 'text-gray-400'}`}>11AM</span>
                 <span className={`text-[10px] font-bold ${isDark ? 'text-blue-200/40' : 'text-gray-400'}`}>2PM</span>
                 <span className={`text-[10px] font-bold ${isDark ? 'text-blue-200/40' : 'text-gray-400'}`}>5PM</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
