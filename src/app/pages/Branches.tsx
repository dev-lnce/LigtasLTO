import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../ThemeContext';
import { useNavigate, useLocation } from 'react-router';
import { strings } from '../../locales/strings.fil';
import { Branch, getBranchesMock } from '../data/branches';
import { BranchDetailsSheet } from '../components/BranchDetailsSheet';
import { vibrateSafe } from '../utils/haptics';
import { SkeletonShimmer } from '../components/SkeletonShimmer';

const FILTERS = ['Lahat', 'May Plastic', 'Mabilis', 'May Flag'];

export function Branches() {
  const { isDark, isDemoMode, demoDistanceKm, demoAddedWaitMins, getAdjustedWaitTime } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeFilter, setActiveFilter] = useState('Lahat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setLoading] = useState(true); // IMPROVEMENT 3: Skeleton loading while branches are "fetching".
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null); // FIX 5: Selected branch for the details bottom sheet.
  const [isDetailsOpen, setDetailsOpen] = useState(false); // FIX 5: Bottom sheet open state.
  const [onboardingTransaction, setOnboardingTransaction] = useState<string | null>(null); // FIX 4A: Transaction-first pre-filter.

  // Scenario 5: Intent State
  const [intentBranches, setIntentBranches] = useState<Record<string, boolean>>({});

  // Distinct Data Path mapping
  const adjustedBranches = useMemo(() => {
    return branches.map(b => ({
      ...b,
      walkinAvgMinutes: getAdjustedWaitTime(b.walkinAvgMinutes),
      appointmentAvgMinutes: getAdjustedWaitTime(b.appointmentAvgMinutes),
    }));
  }, [branches, getAdjustedWaitTime]);

  // Read ?filter= URL param on mount to pre-apply filter
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const filterParam = params.get('filter');
      if (filterParam) {
        const filterMap: Record<string, string> = {
          'may-plastic': 'May Plastic',
          'mabilis': 'Mabilis',
          'may-flag': 'May Flag',
        };
        const mapped = filterMap[filterParam];
        if (mapped) setActiveFilter(mapped);
      }
    } catch { }
  }, [location.search]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const data = await getBranchesMock();
        if (!mounted) return;

        if (isDemoMode) {
          // DEMO MODE: Mock location and queue queue times using demo controls
          const processedData = data.map((b, i) => ({
            ...b,
            distanceKm: parseFloat((demoDistanceKm + (i * 1.5) % 8).toFixed(1)),
            walkinAvgMinutes: Math.max(0, b.walkinAvgMinutes + demoAddedWaitMins),
            appointmentAvgMinutes: Math.max(0, b.appointmentAvgMinutes + Math.floor(demoAddedWaitMins / 2)),
          }));
          setBranches(processedData);
          setLoading(false);
        } else {
          // REAL MODE: Get real geolocation
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                console.log('Real coordinates: ', pos.coords.latitude, pos.coords.longitude);
                if (mounted) {
                  setBranches(data);
                  setLoading(false);
                }
              },
              (err) => {
                console.warn('Geolocation fallback:', err);
                if (mounted) {
                  setBranches(data);
                  setLoading(false);
                }
              },
              { enableHighAccuracy: true, timeout: 5000 }
            );
          } else {
            if (mounted) {
              setBranches(data);
              setLoading(false);
            }
          }
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [isDemoMode, demoDistanceKm, demoAddedWaitMins]);

  useEffect(() => {
    // FIX 4A: Read onboarding transaction selection.
    try {
      setOnboardingTransaction(localStorage.getItem('ligtaslto_transaction'));
    } catch {
      setOnboardingTransaction(null);
    }

    const onComplete = (e: any) => {
      setOnboardingTransaction(e?.detail?.selectedType ?? null);
    };
    window.addEventListener('ligtaslto:onboarding-complete', onComplete as any);
    return () => window.removeEventListener('ligtaslto:onboarding-complete', onComplete as any);
  }, []);

  // Filter Logic
  const filteredBranches = useMemo(() => {
    const baseFiltered = adjustedBranches.filter((b) => {
      if (searchQuery.length >= 1) {
        const q = searchQuery.toLowerCase();
        if (!b.name.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q)) return false;
      }
      if (activeFilter === 'May Plastic' && !b.hasPlasticCards) return false; // FIX 7: Use shared plastic flag.
      if (activeFilter === 'Mabilis' && b.walkinAvgMinutes >= 120) return false; // FIX 7: "Mabilis" means <2h walk-in.
      if (activeFilter === 'May Flag' && !b.hasActiveAnomaly) return false; // IMPROVEMENT 2: Use shared anomaly flag.
      return true;
    });

    const mapTx = (t: string | null): string | null => {
      if (!t) return null;
      switch (t) {
        case 'Hindi ko alam':
          return null;
        case 'License Renewal':
          return 'License Renewal';
        case 'Vehicle Registration':
          return 'MV Registration';
        case "Driver's License":
          return 'New License';
        case 'Student Permit':
          return 'Other';
        // Allow direct queue-type values if they exist.
        case 'MV Registration':
          return 'MV Registration';
        case 'New License':
          return 'New License';
        case 'Other':
          return 'Other';
        default:
          return null;
      }
    };

    const mappedTx = mapTx(onboardingTransaction);
    if (!mappedTx) return baseFiltered;

    const txFiltered = baseFiltered.filter((b) => b.recentReports?.some((r) => r.transactionType === mappedTx));
    return txFiltered.length ? txFiltered : baseFiltered;
  }, [activeFilter, branches, searchQuery, onboardingTransaction]);

  const toggleIntent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIntentBranches(prev => ({ ...prev, [id]: !prev[id] }));
    // API Call: POST /api/branches/:id/intent
    fetch(`/api/branches/${id}/intent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_hash: 'device-12345' }) }).catch(() => { });
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

  const getMorningEstimateText = (b: Branch) => {
    const tomorrowDow = new Date(Date.now() + 24 * 60 * 60 * 1000).getDay();
    const samples = b.historical_estimates?.walkin_morning_wait_minutes_by_dow?.[tomorrowDow];
    if (!samples || samples.length < 5) return null;
    const sorted = [...samples].sort((a, c) => a - c);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const medianMins = Math.round(median);
    const h = Math.floor(medianMins / 60);
    const m = medianMins % 60;
    return `Bukas, ~${h}h ${m}m ang pila (Walk-in)`;
  };

  const getArrivalTimeEstimateText = (b: Branch) => {
    if (!b.high_demand_warning) return null;
    const distances = b.intentDistancesKmLast15m || [];
    if (!distances.length) return null;

    const avgKm = distances.reduce((a, c) => a + c, 0) / distances.length;
    const travelMinutes = (avgKm / 20) * 60;
    const arrival = new Date(Date.now() + travelMinutes * 60 * 1000);
    const raw = arrival.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const cleaned = raw.replace(/\s?(AM|PM)$/, (m) => m.toUpperCase()).replace(' AM', 'AM').replace(' PM', 'PM');

    return { count: distances.length, arrivalTime: cleaned };
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
          className="w-full bg-surface-container-lowest dark:bg-slate-800 border-none rounded-full py-4 pl-14 pr-6 text-on-surface dark:text-slate-100 placeholder:text-outline dark:placeholder-slate-500 focus:ring-2 focus:ring-primary-fixed dark:focus:ring-slate-500 shadow-sm transition-all duration-300"
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
                ? 'px-6 py-2.5 rounded-full bg-[#E63946] text-white font-bold text-sm whitespace-nowrap shadow-md shadow-[#E63946]/20 transition-transform active:scale-95'
                : 'px-6 py-2.5 rounded-full bg-surface-container-high dark:bg-slate-700 text-on-surface-variant dark:text-slate-300 font-semibold text-sm whitespace-nowrap hover:bg-surface-variant transition-colors'
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
            className="bg-surface-container-lowest dark:bg-slate-800 rounded-[12px] h-[auto] overflow-hidden shadow-[0_8px_32px_rgba(25,28,30,0.06)] border border-outline-variant/10 dark:border-slate-700/30 group cursor-pointer"
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
                <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] z-10">
                  <div className="bg-error text-on-error px-6 py-3 rounded-full text-[13px] font-black uppercase tracking-[0.15em] flex items-center gap-3 shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
                    {strings.punoBanner}
                  </div>
                </div>
              )}
            </div>

            <div className="p-[16px]">
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
                  className={`shrink-0 px-3 py-1 rounded-md border text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1 ${intentBranches[featured.id]
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
                <div className="bg-surface-container-low dark:bg-slate-700 p-[16px] rounded-[12px] h-[auto] border border-outline-variant/5 dark:border-slate-700/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-[600] text-tertiary uppercase tracking-[0.08em]">Walk-in</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-extrabold ${waitTone(featured.walkinAvgMinutes)}`}>{Math.round(featured.walkinAvgMinutes / 60 * 10) / 10}h</span> {/* FIX 7: Use shared minutes-based value. */}
                    <span className={`material-symbols-outlined ${waitTone(featured.walkinAvgMinutes)} text-lg`}>trending_up</span>
                  </div>
                </div>
                <div className="bg-surface-container-low dark:bg-slate-700 p-[16px] rounded-[12px] h-[auto] border border-outline-variant/5 dark:border-slate-700/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-[600] text-tertiary uppercase tracking-[0.08em]">Appointment</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-extrabold ${waitTone(featured.appointmentAvgMinutes)}`}>{featured.appointmentAvgMinutes}m</span> {/* FIX 7: Use shared appointment average minutes. */}
                    <span className={`material-symbols-outlined ${waitTone(featured.appointmentAvgMinutes)} text-lg`}>trending_down</span>
                  </div>
                </div>
              </div>

              {(() => {
                const estimate = getMorningEstimateText(featured);
                if (!estimate) return null;
                return (
                  <div className="mt-4 flex items-center gap-2 text-[12px] text-on-surface-variant dark:text-slate-400">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                      schedule
                    </span>
                    {(() => {
                      const parts = estimate.split('Walk-in');
                      return (
                        <>
                          {parts[0]}
                          <span className="inline-flex items-center gap-1">
                            Walk-in
                          </span>
                          {parts[1] || ''}
                        </>
                      );
                    })()}
                  </div>
                );
              })()}

              {(() => {
                const herd = getArrivalTimeEstimateText(featured);
                if (!herd) return null;
                return (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <div className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 whitespace-normal">
                      ~{herd.count} katao papunta — karamihan aabot ng {herd.arrivalTime}.
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-on-surface-variant dark:text-slate-400">
                      Kung aalis ka ngayon, maaabot mo pa bago sila.
                    </div>
                  </div>
                );
              })()}

              {featured.is_puno ? (
                <button
                  type="button"
                  disabled
                  className="w-full mt-8 py-4 rounded-full bg-[#6B1F1F] text-white font-extrabold text-sm opacity-90 cursor-not-allowed"
                >
                  <span className="inline-flex items-center gap-2">
                    PUNO NA — Bumalik Bukas {/* IMPROVEMENT 1: PUNO disables actions everywhere and shows the same banner/state. */}
                  </span>
                </button>
              ) : (
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(featured);
                    }}
                    className="flex-1 py-3 rounded-full border border-primary dark:border-slate-500 text-primary dark:text-slate-300 font-bold text-sm bg-transparent active:scale-95 transition-transform"
                  >
                    Tingnan Details {/* FIX 6: Details button opens the full info bottom sheet. */}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goQueue(featured);
                    }}
                    className="flex-1 py-3 rounded-full bg-primary text-white dark:bg-white dark:text-slate-900 font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
                  >
                    Pumila Dito
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
          <h3 className="text-lg font-bold text-on-surface dark:text-slate-100 px-1 mb-4">Iba pang Sanga Malapit Sayo</h3>
          <div className="space-y-4">
            {others.map((b) => (
              <div
                key={b.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-[16px] bg-surface-container-low dark:bg-slate-800/60 rounded-[12px] h-[auto] hover:bg-surface-container-high dark:hover:bg-slate-700 transition-colors cursor-pointer group"
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
                      <span className="text-[10px] font-[600] uppercase tracking-[0.08em] text-tertiary">Wait</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold border ${b.hasPlasticCards ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
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

                  {(() => {
                    const estimate = getMorningEstimateText(b);
                    if (!estimate) return null;
                    return (
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-on-surface-variant dark:text-slate-400">
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                          schedule
                        </span>
                        {(() => {
                          const parts = estimate.split('Walk-in');
                          return (
                            <>
                              {parts[0]}
                              <span className="inline-flex items-center gap-1">
                                Walk-in
                              </span>
                              {parts[1] || ''}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {(() => {
                    const herd = getArrivalTimeEstimateText(b);
                    if (!herd) return null;
                    return (
                      <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                        <div className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 whitespace-normal">
                          ~{herd.count} katao papunta — karamihan aabot ng {herd.arrivalTime}.
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-on-surface-variant dark:text-slate-400">
                          Kung aalis ka ngayon, maaabot mo pa bago sila.
                        </div>
                      </div>
                    );
                  })()}

                  {b.is_puno ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-full bg-[#6B1F1F] text-white font-extrabold text-xs opacity-90 cursor-not-allowed"
                    >
                      <span className="inline-flex items-center gap-2">
                        PUNO NA — Bumalik Bukas {/* IMPROVEMENT 1: PUNO state disables row actions too. */}
                      </span>
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
                        className="flex-1 py-2 rounded-full bg-primary text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-md shadow-primary/20 active:scale-95 transition-transform"
                      >
                        Pumila Dito
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
