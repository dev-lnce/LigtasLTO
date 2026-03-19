import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import { strings } from '../../locales/strings.fil';
import { Branch, getBranchesMock } from '../data/branches';
import { BranchDetailsSheet } from '../components/BranchDetailsSheet';
import { vibrateSafe } from '../utils/haptics';
import { SkeletonShimmer } from '../components/SkeletonShimmer';

const FILTERS = ['Lahat', 'May Plastic', 'Mabilis', 'May Flag'];

export function Branches() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState('Lahat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setLoading] = useState(true); // IMPROVEMENT 3: Skeleton loading while branches are "fetching".
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null); // FIX 5: Selected branch for the details bottom sheet.
  const [isDetailsOpen, setDetailsOpen] = useState(false); // FIX 5: Bottom sheet open state.
  
  // Scenario 5: Intent State
  const [intentBranches, setIntentBranches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // IMPROVEMENT 3: Async-load the shared branches list for consistent flags (PUNO/anomaly/etc).
    let mounted = true;
    setLoading(true);
    getBranchesMock()
      .then((data) => {
        if (!mounted) return;
        setBranches(data);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Filter Logic
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (searchQuery.length >= 2) {
        const q = searchQuery.toLowerCase();
        if (!b.name.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q)) return false;
      }
      if (activeFilter === 'May Plastic' && !b.hasPlasticCards) return false; // FIX 7: Use shared plastic flag.
      if (activeFilter === 'Mabilis' && b.walkinAvgMinutes >= 120) return false; // FIX 7: "Mabilis" means <2h walk-in.
      if (activeFilter === 'May Flag' && !b.hasActiveAnomaly) return false; // IMPROVEMENT 2: Use shared anomaly flag.
      return true;
    });
  }, [activeFilter, branches, searchQuery]);

  const toggleIntent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIntentBranches(prev => ({ ...prev, [id]: !prev[id] }));
    // API Call: POST /api/branches/:id/intent
    fetch(`/api/branches/${id}/intent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_hash: 'device-12345' }) }).catch(()=>{});
  };

  const featured = filteredBranches[0];
  const others = filteredBranches.slice(1);

  const openDetails = (b: Branch) => {
    setSelectedBranch(b); // FIX 5: Open the details bottom sheet with full branch info.
    setDetailsOpen(true);
  };

  const goQueue = (b: Branch) => {
    vibrateSafe(100); // IMPROVEMENT 5: Haptic feedback on "Pumila Dito" (100ms).
    navigate(`/queue?branch=${encodeURIComponent(b.id)}`); // FIX 6: Pass branch id to Queue screen for preselection.
  };

  const waitTone = (mins: number) => {
    // FIX 6/7: Shared wait color rules (green <2h, amber 2–3.5h, red >3.5h).
    if (mins < 120) return 'text-tertiary';
    if (mins <= 210) return 'text-amber-600';
    return 'text-error';
  };

  return (
    <>
      <BranchDetailsSheet open={isDetailsOpen} branch={selectedBranch} onClose={() => setDetailsOpen(false)} />

      {/* Search Bar */}
      <div className="relative group mt-4">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-outline">search</span>
        </div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface-container-lowest border-none rounded-full py-4 pl-14 pr-6 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary-fixed shadow-sm transition-all duration-300"
          placeholder="Maghanap ng Sanga (e.g. Quezon City)"
          type="text"
        />
      </div>

      {/* Category Chips */}
      <div className="flex gap-3 mt-6 overflow-x-auto pb-2 scrollbar-hide">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => {
              vibrateSafe(50); // IMPROVEMENT 5: Haptic feedback on filter chip selection (50ms).
              setActiveFilter(filter);
            }}
            className={
              activeFilter === filter
                ? 'px-6 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm whitespace-nowrap shadow-md shadow-primary/20 transition-transform active:scale-95'
                : 'px-6 py-2.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold text-sm whitespace-nowrap hover:bg-surface-variant transition-colors'
            }
          >
            {filter}
          </button>
        ))}
      </div>

      {/* IMPROVEMENT 4: Empty state when no branches match search/filter. */}
      {!isLoading && filteredBranches.length === 0 && (
        <div className="py-14 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant dark:text-slate-400">search_off</span>
          <div className="mt-3 font-bold text-on-surface dark:text-slate-100">Walang nahanap na branch</div>
          <div className="text-sm text-on-surface-variant dark:text-slate-400 mt-1">Subukan ang ibang keyword</div>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-5 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
          >
            I-clear ang Search {/* IMPROVEMENT 4: Clear input to restore list. */}
          </button>
        </div>
      )}

      {/* Featured Branch */}
      {featured && (
        <div className="mt-8 relative">
          <div
            className="bg-surface-container-lowest dark:bg-slate-800 rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(25,28,30,0.06)] border border-outline-variant/10 dark:border-slate-700/30 group cursor-pointer"
            onClick={() => openDetails(featured)} // FIX 5: Card tap opens details (not a silent no-op).
          >
            <div className="relative h-48 w-full overflow-hidden">
              <img
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                alt="LTO Branch"
                src={featured.thumbnailUrl} // FIX 7: Use shared thumbnail so rows/cards stay consistent.
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              {featured.is_puno && (
                <div className="absolute top-4 left-4 bg-error text-on-error px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  {strings.punoBanner}
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight text-on-surface dark:text-slate-100">{featured.name}</h2>
                  <p className="text-on-surface-variant dark:text-slate-400 text-sm flex items-center gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-base">location_on</span>
                    {featured.address}
                  </p>
                </div>
                <button
                  onClick={(e) => toggleIntent(featured.id, e)}
                  className={`shrink-0 px-3 py-1 rounded-md border text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1 ${
                    intentBranches[featured.id]
                      ? 'bg-tertiary-container/10 text-tertiary border-outline-variant/10 dark:border-slate-700/30'
                      : 'bg-surface-container-low dark:bg-slate-700/50 text-on-surface-variant dark:text-slate-400 border-outline-variant/10 dark:border-slate-700/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                    navigation
                  </span>
                  {intentBranches[featured.id] ? 'Papunta na' : strings.intentToggle}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-surface-container-low dark:bg-slate-700/50 p-4 rounded-xl border border-outline-variant/5 dark:border-slate-700/30">
                  <span className="text-[10px] font-bold text-outline uppercase tracking-wider block mb-1">Walk-in</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-extrabold ${waitTone(featured.walkinAvgMinutes)}`}>{Math.round(featured.walkinAvgMinutes / 60 * 10) / 10}h</span> {/* FIX 7: Use shared minutes-based value. */}
                    <span className={`material-symbols-outlined ${waitTone(featured.walkinAvgMinutes)} text-lg`}>trending_up</span>
                  </div>
                </div>
                <div className="bg-surface-container-low dark:bg-slate-700/50 p-4 rounded-xl border border-outline-variant/5 dark:border-slate-700/30">
                  <span className="text-[10px] font-bold text-outline uppercase tracking-wider block mb-1">Appointment</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-extrabold ${waitTone(featured.appointmentAvgMinutes)}`}>{featured.appointmentAvgMinutes}m</span> {/* FIX 7: Use shared appointment average minutes. */}
                    <span className={`material-symbols-outlined ${waitTone(featured.appointmentAvgMinutes)} text-lg`}>trending_down</span>
                  </div>
                </div>
              </div>

              {featured.is_puno ? (
                <button
                  type="button"
                  disabled
                  className="w-full mt-8 py-4 rounded-full bg-[#6B1F1F] text-white font-extrabold text-sm opacity-90 cursor-not-allowed"
                >
                  PUNO NA — Bumalik Bukas {/* IMPROVEMENT 1: PUNO disables actions everywhere and shows the same banner/state. */}
                </button>
              ) : (
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(featured);
                    }}
                className="flex-1 py-3 rounded-full border border-primary text-primary font-bold text-sm bg-transparent active:scale-95 transition-transform"
                  >
                    Tingnan Details {/* FIX 6: Details button opens the full info bottom sheet. */}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goQueue(featured);
                    }}
                    className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
                  >
                    Pumila Dito {/* FIX 6: Queue redirect is now a separate primary action. */}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mt-8 space-y-4">
          <SkeletonShimmer className="h-[340px] w-full" /> {/* IMPROVEMENT 3: Skeleton for featured branch card while loading. */}
          <SkeletonShimmer className="h-[120px] w-full" /> {/* IMPROVEMENT 3: Skeleton for branch row while loading. */}
          <SkeletonShimmer className="h-[120px] w-full" /> {/* IMPROVEMENT 3: Skeleton for branch row while loading. */}
        </div>
      )}

      {/* Other branches list */}
      {others.length > 0 && (
        <div className="mt-12 mb-8">
          <h3 className="text-lg font-bold text-on-surface px-1 mb-4">Iba pang Sanga Malapit Sayo</h3>
          <div className="space-y-4">
            {others.map((b) => (
              <div
                key={b.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-surface-container-low dark:bg-slate-700/50 rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer group"
                onClick={() => openDetails(b)} // FIX 5: Row tap opens details.
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high">
                  <img
                    className="w-full h-full object-cover"
                    alt="LTO Branch"
                    src={b.thumbnailUrl} // FIX 7: Use shared thumbnail.
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-on-surface dark:text-slate-100 truncate">{b.name}</h4>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400 truncate">
                        {b.address} • {b.distanceKm.toFixed(1)} km {/* FIX 7: Show address + distance on list rows. */}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`block text-sm font-black ${waitTone(b.walkinAvgMinutes)}`}>{Math.round(b.walkinAvgMinutes / 60 * 10) / 10}h</span>
                      <span className="text-[9px] font-bold uppercase text-outline">Wait</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold border ${
                        b.hasPlasticCards ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
                      }`}
                    >
                      {b.hasPlasticCards ? 'May Plastic' : 'Wala Plastic'} {/* IMPROVEMENT 7: Plastic status pill on list rows. */}
                    </span>
                    {b.prequeueMinutesBeforeOpen !== undefined && (
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold border bg-amber-500/10 text-amber-700 border-amber-500/25">
                        Pila: ~{b.prequeueMinutesBeforeOpen}m bago bukas {/* IMPROVEMENT 7: Pre-queue estimate pill on list rows. */}
                      </span>
                    )}
                  </div>

                  {b.is_puno ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-full bg-[#6B1F1F] text-white font-extrabold text-xs opacity-90 cursor-not-allowed"
                    >
                      PUNO NA — Bumalik Bukas {/* IMPROVEMENT 1: PUNO state disables row actions too. */}
                    </button>
                  ) : (
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(b);
                        }}
                        className="flex-1 py-2 rounded-full border border-primary text-primary font-bold text-xs bg-transparent active:scale-95 transition-transform"
                      >
                        Tingnan Details {/* FIX 6/7: List rows now match featured detail-level with actions. */}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          goQueue(b);
                        }}
                        className="flex-1 py-2 rounded-full bg-primary text-white font-bold text-xs shadow-md shadow-primary/20 active:scale-95 transition-transform"
                      >
                        Pumila Dito {/* FIX 6/7: Separate queue redirect button on rows. */}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
