import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, CreditCard, AlertTriangle, Clock, Maximize2, Minimize2, Navigation, ChevronRight, Users, Info } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import { strings } from '../../locales/strings.fil';

const BRANCHES = [
  { 
    id: '1', name: 'LTO Diliman District', address: 'East Avenue, QC', statusColor: 'red' as const, 
    badges: [{ text: 'May Plastic', type: 'success' as const }], 
    walkinAvgSeconds: 12000, 
    waitTimeWalkin: '3h 20m', waitTimeAppointment: '45m', 
    isPuno: true, highDemand: true, 
    activeRequirements: [{ tag: 'Updated MedCert', count: 12 }, { tag: 'Short bond only', count: 5 }],
    prequeueWait: 45
  },
  { 
    id: '2', name: 'LTO Novaliches', address: 'Robinsons Novaliches, QC', statusColor: 'green' as const, 
    badges: [{ text: 'May Plastic', type: 'success' as const }], 
    walkinAvgSeconds: 6000,
    waitTimeWalkin: '1h 40m', waitTimeAppointment: '20m', 
    isPuno: false, highDemand: false, 
    activeRequirements: [],
    prequeueWait: 15
  },
  { 
    id: '3', name: 'QC Licensing Center', address: 'P. Tuazon Blvd, Cubao', statusColor: 'amber' as const, 
    badges: [{ text: 'Wala Plastic', type: 'danger' as const }], 
    walkinAvgSeconds: 8500,
    waitTimeWalkin: '2h 20m', waitTimeAppointment: '50m', 
    isPuno: false, highDemand: true, 
    activeRequirements: [{ tag: 'Extra photocopy', count: 3 }],
    prequeueWait: 30
  }
];

const MAP_POINTS = [
  { id: '1', top: '25%', left: '20%', color: '#10B981', branch: BRANCHES[1], delay: '0s' },
  { id: '2', top: '40%', left: '55%', color: '#E63946', branch: BRANCHES[0], delay: '0.4s' },
  { id: '3', top: '30%', left: '75%', color: '#F59E0B', branch: BRANCHES[2], delay: '0.8s' },
];

const FILTERS = ['Lahat', 'May Plastic', 'Mabilis', 'May Flag'];

export function Branches() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState('Lahat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMapExpanded, setMapExpanded] = useState(false);
  const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);
  
  // Scenario 5: Intent State
  const [intentBranches, setIntentBranches] = useState<Record<string, boolean>>({});

  // Filter Logic
  const filteredBranches = BRANCHES.filter(b => {
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q)) return false;
    }
    if (activeFilter === 'May Plastic' && !b.badges.find(badge => badge.text.includes('May Plastic'))) return false;
    // Scenario 10: "Mabilis" filter requires walkin < 7200 seconds (2 hours)
    if (activeFilter === 'Mabilis' && b.walkinAvgSeconds >= 7200) return false;
    if (activeFilter === 'May Flag' && !b.badges.find(badge => badge.text.includes('May Anomaly'))) return false;
    return true;
  });

  const isBranchVisible = (id: string) => filteredBranches.some(b => b.id === id);

  const toggleIntent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIntentBranches(prev => ({ ...prev, [id]: !prev[id] }));
    // API Call: POST /api/branches/:id/intent
    fetch(`/api/branches/${id}/intent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_hash: 'device-12345' }) }).catch(()=>{});
  };

  return (
    <>
      {/* Search Header / Map code remains mostly original */}
      <header className="px-6 pb-4">
        <div className="flex items-center justify-between">
          <motion.h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Mga Branch
          </motion.h1>
           <button onClick={() => navigate(-1)} className={`p-2.5 rounded-full border ${isDark ? 'bg-[#162A45] border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
             <ChevronRight className="rotate-180" size={18} />
           </button>
        </div>
      </header>

      {/* Map View */}
      <div className="px-6 mb-5">
        <motion.div animate={{ height: isMapExpanded ? 350 : 180 }} className={`relative w-full rounded-3xl overflow-hidden border shadow-inner ${isDark ? 'bg-[#0A1626] border-white/10' : 'bg-gray-100 border-gray-300'}`}>
           {/* Dots */}
           {MAP_POINTS.map(pt => {
             const isDimmed = !isBranchVisible(pt.branch.id) && (searchQuery.length >= 2 || activeFilter !== 'Lahat');
             return (
               <div key={pt.id} className="absolute" style={{ top: pt.top, left: pt.left }}>
                 <button onClick={() => setSelectedMapNode(pt.id)} className={`relative transition-opacity duration-300 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}>
                   <div className="w-4 h-4 rounded-full animate-pulse border-2 border-white/80" style={{ backgroundColor: pt.branch.isPuno ? '#b32b37' : pt.color, animationDelay: pt.delay }} />
                 </button>
               </div>
             );
           })}
        </motion.div>
      </div>

      <div className="pl-6 mb-6 flex gap-2.5 overflow-x-auto pb-2 pr-6">
        {FILTERS.map((filter) => (
          <motion.button key={filter} onClick={() => setActiveFilter(filter)} className={`whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-extrabold transition-all border ${activeFilter === filter ? 'bg-[#E63946] text-white border-[#E63946] shadow-lg shadow-[#E63946]/20' : (isDark ? 'bg-[#162A45] text-blue-200/70 border-white/10' : 'bg-white text-gray-600 border-gray-200')}`}>
            {filter}
          </motion.button>
        ))}
      </div>

      <div className="px-6 flex flex-col gap-5 pb-8">
        {filteredBranches.map((branch) => {
          const isIntent = intentBranches[branch.id];

          return (
            <div key={branch.id} className="relative w-full rounded-[24px] overflow-hidden group">
               <motion.div className={`relative w-full z-10 rounded-[24px] p-5 border flex flex-col shadow-sm ${isDark ? 'bg-[#162A45] border-white/5' : 'bg-white border-gray-200'}`}>
                 
                 {/* Scenario 6: PUNO Banner Override */}
                 {branch.isPuno && (
                   <div className="absolute top-0 left-0 right-0 bg-red-900 border-b border-red-700 p-2 text-center text-red-50 font-black text-[11px] tracking-widest uppercase">
                     {strings.punoBanner}
                   </div>
                 )}

                 <div className={`flex justify-between items-start ${branch.isPuno ? 'mt-8' : ''}`}>
                    <div>
                      <h3 className={`font-black text-[17px] mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{branch.name}</h3>
                      <p className={`text-xs font-medium flex items-center gap-1 mb-2 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}><MapPin size={12} /> {branch.address}</p>
                    </div>
                    {/* Scenario 5: Intent Button */}
                    <button onClick={(e) => toggleIntent(branch.id, e)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 ${isIntent ? 'bg-[#3B82F6] text-white border-[#3B82F6]' : (isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-100 border-gray-200 text-gray-900')}`}>
                       <Navigation size={10} /> {isIntent ? 'Papunta na' : strings.intentToggle}
                    </button>
                 </div>

                 {/* Scenario 5: High Demand Pill */}
                 {branch.highDemand && !branch.isPuno && (
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 mb-4">
                       <Users size={14} className="flex-shrink-0" /> {strings.highDemandWarning}
                    </div>
                 )}

                 {/* Scenario 9: Community Requirements Feed Warning */}
                 {branch.activeRequirements.length > 0 && (
                    <div className={`px-3 py-2 rounded-xl text-xs font-extrabold flex flex-col gap-1 mb-4 ${isDark ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                       <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14}/> <span>Heads Up: Mga dagdag na hinihingi</span></div>
                       {branch.activeRequirements.map(req => (
                         <span key={req.tag} className="ml-5 font-medium opacity-90">• {strings.requirementsWarning.replace('{count}', req.count.toString()).replace('{req}', req.tag)}</span>
                       ))}
                    </div>
                 )}

                 <div className="flex flex-wrap gap-2 mb-4">
                   {branch.badges.map((b, i) => (
                     <div key={i} className={`px-2 py-1 rounded-md text-[10px] font-extrabold border flex items-center gap-1 ${isDark ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                       <CreditCard size={10} /> {b.text.toUpperCase()}
                     </div>
                   ))}
                 </div>

                 <div className={`flex flex-col gap-2 p-3 rounded-2xl ${isDark ? 'bg-[#0A1626]' : 'bg-gray-50'}`}>
                   {/* Scenario 11: Pre-queue stats */}
                   {branch.prequeueWait > 0 && (
                     <div className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        <Info size={10} /> {strings.prequeueStats.replace('{minutes}', branch.prequeueWait.toString())}
                     </div>
                   )}
                   {/* Scenario 10: Dual Wait Time Lines */}
                   <div className="flex justify-between items-center">
                     <span className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}><Clock size={12} className="inline mr-1" /> Walk-in</span>
                     <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{branch.waitTimeWalkin}</span>
                   </div>
                   <div className="flex justify-between items-center opacity-70">
                     <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}><CreditCard size={12} className="inline mr-1" /> Appointment</span>
                     <span className={`font-black text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{branch.waitTimeAppointment}</span>
                   </div>
                 </div>

                 {/* Action Button */}
                 <button onClick={() => navigate('/queue')} className="w-full mt-4 bg-[#E63946] text-white py-3.5 rounded-xl font-black text-sm active:scale-[0.98]">
                    {branch.isPuno ? 'Tingnan Details' : 'Pumila Dito'}
                 </button>
               </motion.div>
            </div>
          );
        })}
      </div>
    </>
  );
}
