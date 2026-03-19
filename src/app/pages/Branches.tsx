import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, CreditCard, AlertTriangle, Clock, Maximize2, Minimize2, Navigation, ChevronRight } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';

const BRANCHES = [
  { id: '1', name: 'LTO Diliman District', address: 'East Avenue, QC', statusColor: 'amber' as const, badges: [{ text: 'May Plastic', type: 'success' as const }, { text: 'Siksikan', type: 'warning' as const }], waitTime: '2-3 Oras' },
  { id: '2', name: 'LTO Novaliches', address: 'Robinsons Novaliches, QC', statusColor: 'green' as const, badges: [{ text: 'May Plastic', type: 'success' as const }, { text: 'Mabilis', type: 'success' as const }], waitTime: '45 Minuto' },
  { id: '3', name: 'QC Licensing Center', address: 'P. Tuazon Blvd, Cubao', statusColor: 'red' as const, badges: [{ text: 'Wala Plastic', type: 'danger' as const }, { text: 'May Anomaly', type: 'warning' as const }], waitTime: '4+ Oras' },
  { id: '4', name: 'San Bartolome Branch', address: 'Quirino Highway', statusColor: 'green' as const, badges: [{ text: 'May Plastic', type: 'success' as const }], waitTime: '1 Oras' }
];

const MAP_POINTS = [
  { id: '1', top: '25%', left: '20%', color: '#10B981', branch: BRANCHES[1], delay: '0s' },
  { id: '2', top: '40%', left: '55%', color: '#F59E0B', branch: BRANCHES[0], delay: '0.4s' },
  { id: '3', top: '30%', left: '75%', color: '#E63946', branch: BRANCHES[2], delay: '0.8s' },
  { id: '4', top: '60%', left: '30%', color: '#10B981', branch: BRANCHES[3], delay: '1.2s' },
];

const FILTERS = ['Lahat', 'May Plastic', 'Mabilis', 'May Flag'];

export function Branches() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState('Lahat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMapExpanded, setMapExpanded] = useState(false);
  const [selectedMapNode, setSelectedMapNode] = useState<string | null>(null);

  // Filter Logic
  const filteredBranches = BRANCHES.filter(b => {
    // 1. Text Search (min 2 chars)
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q)) {
        return false;
      }
    }
    // 2. Chip Filter logic (Mocked based on text for simplicity)
    if (activeFilter === 'May Plastic' && !b.badges.find(badge => badge.text.includes('May Plastic'))) return false;
    if (activeFilter === 'Mabilis' && !b.badges.find(badge => badge.text.includes('Mabilis'))) return false;
    if (activeFilter === 'May Flag' && !b.badges.find(badge => badge.text.includes('May Anomaly'))) return false;
    return true;
  });

  const isBranchVisible = (id: string) => filteredBranches.some(b => b.id === id);

  return (
    <>
      <header className="px-6 pb-4">
        <div className="flex items-center justify-between">
          <motion.h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Mga Branch
          </motion.h1>
          <div className="flex flex-col items-end">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${isDark ? 'bg-[#162A45] border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Live</span>
            </div>
            <span className={`text-[10px] mt-1 font-medium ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>9:41 AM</span>
          </div>
        </div>
      </header>

      {/* Map View */}
      <div className="px-6 mb-5">
        <motion.div 
          animate={{ height: isMapExpanded ? 350 : 180 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`relative w-full rounded-3xl overflow-hidden border shadow-inner ${isDark ? 'bg-[#0A1626] border-white/10' : 'bg-gray-100 border-gray-300'}`}
        >
          <div className={`absolute inset-0 bg-[linear-gradient(to_right,${isDark ? '#ffffff08' : '#00000008'}_1px,transparent_1px),linear-gradient(to_bottom,${isDark ? '#ffffff08' : '#00000008'}_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none`} />
          
          {/* Map Controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
             <button 
                onClick={() => setMapExpanded(!isMapExpanded)}
                className={`p-2 rounded-full border shadow-sm backdrop-blur-md transition-colors ${isDark ? 'bg-[#0D1F35]/80 border-white/10 text-white' : 'bg-white/90 border-gray-200 text-gray-900'}`}
             >
                {isMapExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
             </button>
             <button 
                onClick={() => setSelectedMapNode(null)}
                className={`p-2 rounded-full border shadow-sm backdrop-blur-md transition-colors ${isDark ? 'bg-[#0D1F35]/80 border-white/10 text-white' : 'bg-white/90 border-gray-200 text-gray-900'}`}
             >
                <Navigation size={16} />
             </button>
          </div>

          <div className={`absolute bottom-3 left-3 px-3 py-1.5 rounded-full border backdrop-blur-md pointer-events-none ${isDark ? 'bg-[#0D1F35]/80 border-white/10' : 'bg-white/80 border-gray-200'}`}>
            <span className={`text-[10px] font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}><MapPin size={10} className={isDark ? 'text-blue-200/70' : 'text-gray-500'} /> Quezon City Area</span>
          </div>

          {/* Map Dots */}
          {MAP_POINTS.map(pt => {
             const isDimmed = !isBranchVisible(pt.branch.id) && (searchQuery.length >= 2 || activeFilter !== 'Lahat');
             return (
               <div key={pt.id} className="absolute" style={{ top: pt.top, left: pt.left }}>
                 <button 
                   onClick={() => setSelectedMapNode(pt.id)}
                   className={`relative transition-opacity duration-300 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
                 >
                   <div className="w-4 h-4 rounded-full animate-pulse border-2 border-white/80" style={{ backgroundColor: pt.color, animationDelay: pt.delay, boxShadow: `0 0 15px ${pt.color}cc` }} />
                 </button>
                 
                 {/* Mini Popup */}
                 <AnimatePresence>
                   {selectedMapNode === pt.id && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10, scale: 0.9 }}
                       animate={{ opacity: 1, y: 0, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.9 }}
                       className={`absolute bottom-6 -left-16 w-36 p-2.5 rounded-xl border shadow-xl z-20 ${isDark ? 'bg-[#162A45] border-white/10' : 'bg-white border-gray-200'}`}
                     >
                        <h4 className={`text-[11px] font-bold mb-0.5 leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{pt.branch.name}</h4>
                        <p className={`text-[9px] font-bold flex items-center gap-1 mb-2 ${isDark ? 'text-[#F59E0B]' : 'text-amber-600'}`}><Clock size={9}/> {pt.branch.waitTime}</p>
                        <button 
                          onClick={() => navigate('/queue')}
                          className="w-full bg-[#E63946] text-white py-1 rounded-md text-[9px] font-black tracking-wider uppercase"
                        >
                           Tingnan
                        </button>
                        {/* Triangle pointer */}
                        <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b ${isDark ? 'bg-[#162A45] border-white/10' : 'bg-white border-gray-200'}`} />
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
             );
          })}
        </motion.div>
      </div>

      <div className="pl-6 mb-6 flex gap-2.5 overflow-x-auto pb-2 pr-6 relative scrollbar-hide">
        <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l pointer-events-none z-10 ${isDark ? 'from-[#0D1F35]' : 'from-gray-50'}`} />
        {FILTERS.map((filter) => (
          <motion.button key={filter} onClick={() => setActiveFilter(filter)} className={`whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-extrabold transition-all flex-shrink-0 border ${activeFilter === filter ? 'bg-[#E63946] text-white border-[#E63946] shadow-lg shadow-[#E63946]/20' : (isDark ? 'bg-[#162A45] text-blue-200/70 border-white/10 hover:bg-[#162A45]/80' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100')}`}>
            {filter}
          </motion.button>
        ))}
      </div>

      <div className="px-6 mb-6 flex items-center gap-3">
        <motion.div className={`flex-1 rounded-2xl p-4 flex items-center gap-3 border transition-colors shadow-inner ${isDark ? 'bg-[#0A1626] border-white/10 focus-within:border-white/30' : 'bg-gray-100 border-gray-300 focus-within:border-gray-400'}`}>
          <Search size={18} className={isDark ? 'text-blue-200/50' : 'text-gray-400'} />
          <input 
            type="text" 
            placeholder="Hanapin ang branch..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`bg-transparent border-none outline-none w-full font-semibold text-sm ${isDark ? 'text-white placeholder:text-blue-200/40' : 'text-gray-900 placeholder:text-gray-400'}`} 
          />
          {searchQuery && (
             <button onClick={() => setSearchQuery('')} className={isDark ? 'text-blue-200/50' : 'text-gray-400'}>
                &times;
             </button>
          )}
        </motion.div>
      </div>

      <div className="px-6 flex flex-col gap-3 pb-8 overflow-hidden">
        {filteredBranches.length === 0 ? (
          <div className="text-center py-10 opacity-50">
             <span className="text-4xl mb-3 block">📍</span>
             <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Walang nahanap na branch.</p>
          </div>
        ) : (
          filteredBranches.map((branch) => {
            const statusColors = {
              green: 'bg-[#10B981] shadow-[#10B981]/40 text-[#10B981]',
              amber: 'bg-[#F59E0B] shadow-[#F59E0B]/40 text-[#F59E0B]',
              red: 'bg-[#E63946] shadow-[#E63946]/40 text-[#E63946]',
            };
            return (
              <div key={branch.id} className="relative w-full rounded-3xl overflow-hidden group">
                 {/* Background Layer: Queue Action (Revealed on Swipe Right) */}
                 <div className="absolute inset-0 bg-[#E63946] flex flex-col items-start justify-center pl-6 text-white font-black tracking-tight cursor-pointer" onClick={() => navigate('/queue')}>
                    <span className="text-[10px] uppercase opacity-80 mb-0.5">Mayroon Akong</span>
                    <span className="text-sm flex items-center gap-1">Queue Dito <ChevronRight size={14} strokeWidth={3} /></span>
                 </div>
                 
                 {/* Foreground Card */}
                 <motion.div 
                   drag="x"
                   dragConstraints={{ left: 0, right: 120 }}
                   dragSnapToOrigin={true}
                   className={`relative w-full z-10 rounded-3xl p-5 border flex items-start justify-between shadow-sm overflow-hidden active:cursor-grabbing ${isDark ? 'bg-[#162A45] border-white/5' : 'bg-white border-gray-200'}`}
                 >
                   <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColors[branch.statusColor].split(' ')[0]} opacity-50`} />
                   <div className="flex-1 flex gap-3 pointer-events-none">
                     <div className="mt-1.5"><div className={`w-3.5 h-3.5 rounded-full shadow-lg ${statusColors[branch.statusColor].split(' ')[0]}`} /></div>
                     <div>
                       <h3 className={`font-black text-[15px] mb-0.5 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{branch.name}</h3>
                       <p className={`text-xs font-medium mb-3 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>{branch.address}</p>
                       <div className="flex flex-wrap gap-1.5">
                         {branch.badges.map((b, i) => {
                           const badgeStyles = {
                             success: isDark ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200',
                             warning: isDark ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30' : 'bg-amber-50 text-amber-600 border-amber-200',
                             danger: isDark ? 'bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30' : 'bg-red-50 text-red-600 border-red-200',
                           };
                           return (
                             <div key={i} className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${badgeStyles[b.type]}`}>
                               {b.type === 'warning' ? <AlertTriangle size={10} /> : <CreditCard size={10} />}
                               {b.text.toUpperCase()}
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   </div>
                   <div className="flex flex-col items-end justify-center h-full pointer-events-none">
                     <span className={`text-[9px] uppercase font-bold tracking-wider mb-1 ${isDark ? 'text-blue-200/40' : 'text-gray-400'}`}>Wait Time</span>
                     <span className={`font-black text-sm whitespace-nowrap ${statusColors[branch.statusColor].split(' ')[2]}`}>{branch.waitTime}</span>
                   </div>
                 </motion.div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
