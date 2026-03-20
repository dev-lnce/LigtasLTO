import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import { toast, Toaster } from 'sonner';
import { Branch, getBranchesMock } from '../data/branches';
import { BranchDetailsSheet } from '../components/BranchDetailsSheet';
import { SkeletonShimmer } from '../components/SkeletonShimmer';
import { DEMO_BRANCHES } from '../../demoBranches.js';

export function Home() {
  const { isDark, isDemoMode, demoDistanceKm, demoAddedWaitMins, getAdjustedWaitTime } = useTheme();
  const navigate = useNavigate();

  const [isChartOpen, setChartOpen] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(true);
  const [isPunoAlertDismissed, setPunoAlertDismissed] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null); // FIX 5: Selected branch drives the details bottom sheet.
  const [isDetailsOpen, setDetailsOpen] = useState(false); // FIX 5: Bottom sheet open state.
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Record<string, boolean>>({}); // IMPROVEMENT 2: Dismiss anomalies for the session only.
  const [decisionBranches, setDecisionBranches] = useState<Branch[]>([]);
  const [expandedAnomaly, setExpandedAnomaly] = useState<Record<string, boolean>>({});

  // Distinct Data Path mapping
  const adjustedBranches = React.useMemo(() => {
    return branches.map(b => ({
      ...b,
      walkinAvgMinutes: getAdjustedWaitTime(b.walkinAvgMinutes),
      appointmentAvgMinutes: getAdjustedWaitTime(b.appointmentAvgMinutes),
    }));
  }, [branches, getAdjustedWaitTime]);

  React.useEffect(() => {
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
            is_puno: i === 2 || i === 5,
            hasActiveAnomaly: i === 0,
          }));
          setBranches(processedData);
          setLoading(false);
        } else {
          // REAL MODE: Get real geolocation
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                console.log('Real coordinates: ', pos.coords.latitude, pos.coords.longitude);
                // Fetch live data based on real location here (using mock data structure for now)
                if (mounted) {
                  setBranches(data);
                  setLoading(false);
                }
              },
              (err) => {
                console.warn('Geolocation access denied or failed:', err);
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

  const openDetails = (b: Branch) => {
    setSelectedBranch(b); // FIX 5: Details now show full branch information via bottom sheet.
    setDetailsOpen(true);
  };

  const goQueue = (b: Branch) => {
    navigate(`/queue?branch=${encodeURIComponent(b.id)}`); // FIX 6: Queue redirect preselects branch via URL param.
  };

  const waitTone = (mins: number) => {
    // FIX 3/6: Wait color rules reused in the compact "Malapit na Sangay" section.
    if (mins < 120) return 'text-tertiary';
    if (mins <= 210) return 'text-amber-600';
    return 'text-error';
  };

  // In Demo Mode, use demo branches for the nearest section so all fields are populated
  const nearest2 = isDemoMode && DEMO_BRANCHES.length >= 2
    ? (DEMO_BRANCHES as Branch[]).slice(0, 2).map((b) => ({
      ...b,
      walkinAvgMinutes: getAdjustedWaitTime(b.walkinAvgMinutes),
      appointmentAvgMinutes: getAdjustedWaitTime(b.appointmentAvgMinutes),
    }))
    : [...adjustedBranches].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 2);

  const getDecisionStatus = (b: Branch) => {
    const walk = b.walkinAvgMinutes;
    const plasticConfirmed = b.hasPlasticCards === true;
    const plasticUncertain = b.plastic_uncertain === true || b.hasPlasticCards === false;
    const hasAnomaly = b.hasActiveAnomaly === true;
    const isPuno = b.is_puno === true;
    const highDemand = b.high_demand_warning === true;
    const historicalRisk = b.historical_puno_risk === true;

    if (isPuno || walk > 240 || hasAnomaly) {
      if (isPuno) return { word: 'HUWAG', tone: 'text-error dark:text-red-400', reason: 'PUNO NA ngayon' };
      if (hasAnomaly) return { word: 'HUWAG', tone: 'text-error dark:text-red-400', reason: 'May anomaly ngayon' };
      return { word: 'HUWAG', tone: 'text-error dark:text-red-400', reason: 'Higit 4h pila' };
    }

    const isIngatByWait = walk >= 120 && walk <= 240;
    if (isIngatByWait || plasticUncertain || highDemand || historicalRisk) {
      if (isIngatByWait) {
        const h = Math.floor(walk / 60);
        const m = walk % 60;
        return {
          word: 'INGAT',
          tone: 'text-amber-600 dark:text-amber-400',
          reason: `${h}h ${m.toString().padStart(2, '0')}m pila`,
        };
      }
      if (plasticUncertain) return { word: 'INGAT', tone: 'text-amber-600 dark:text-amber-400', reason: 'Plastic baka kulang' };
      if (highDemand) {
        const count = b.intentDistancesKmLast15m?.length ?? 0;
        return {
          word: 'INGAT',
          tone: 'text-amber-600 dark:text-amber-400',
          reason: `${count} katao papunta`,
        };
      }
      return { word: 'INGAT', tone: 'text-amber-600 dark:text-amber-400', reason: 'Madalas puno ng 9AM' };
    }

    // PUNTA NA: walk-in avg < 2h + plastic confirmed + no anomaly + not near PUNO.
    const h = Math.floor(walk / 60);
    const m = walk % 60;
    const time = `${h}h ${m.toString().padStart(2, '0')}m`;
    return {
      word: 'PUNTA NA',
      tone: 'text-emerald-600 dark:text-emerald-400',
      reason: `${time}, may plastic`,
    };
  };

  const getArrivalTimeEstimate = (b: Branch) => {
    if (!b.high_demand_warning) return null;
    const distances = b.intentDistancesKmLast15m || [];
    if (!distances.length) return null;
    const avgKm = distances.reduce((a, c) => a + c, 0) / distances.length;
    const travelMinutes = (avgKm / 20) * 60;
    const arrival = new Date(Date.now() + travelMinutes * 60 * 1000);
    const raw = arrival.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const cleaned = raw.replace(' AM', 'AM').replace(' PM', 'PM');
    return { count: distances.length, arrivalTime: cleaned };
  };

  React.useEffect(() => {
    if (!branches.length) return;

    const savedKey = 'ligtaslto_saved_branches';
    const run = async () => {
      const nearest2Local = [...adjustedBranches].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 2);

      let savedIds: string[] = [];
      try {
        // TODO: Backend — add GET /api/branches/saved.
        const res = await fetch('/api/branches/saved');
        if (res.ok) {
          const data = await res.json();
          savedIds = data?.branch_ids || data?.ids || [];
        }
      } catch { }

      if (!savedIds.length) {
        try {
          const raw = localStorage.getItem(savedKey);
          if (raw) savedIds = JSON.parse(raw);
        } catch { }
      }

      if (savedIds.length) {
        const savedBranches = savedIds
          .map((id: string) => adjustedBranches.find((b) => b.id === id))
          .filter(Boolean) as Branch[];
        setDecisionBranches(savedBranches.slice(0, 2));
      } else {
        setDecisionBranches(nearest2Local.slice(0, 2));
      }
    };

    run();
  }, [branches]);

  const handleSaveDecisionBranches = async () => {
    if (!decisionBranches.length) return;
    const ids = decisionBranches.map((b) => b.id);
    try {
      localStorage.setItem('ligtaslto_saved_branches', JSON.stringify(ids));
    } catch { }

    try {
      // TODO: Backend — add POST /api/branches/save.
      await fetch('/api/branches/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_ids: ids }),
      });
    } catch { }
  };
  const visibleAnomalies = adjustedBranches
    .filter((b) => b.hasActiveAnomaly && !dismissedAnomalies[b.id])
    .slice(0, 2); // IMPROVEMENT 2: Max 2 visible anomaly cards.
  const hiddenAnomalyCount = Math.max(
    0,
    adjustedBranches.filter((b) => b.hasActiveAnomaly && !dismissedAnomalies[b.id]).length - visibleAnomalies.length
  );

  // Stale check for the dot (mocking < 10 mins as true for now, but keeping the logic visible)
  const isDataStale = false;

  const handleAlertsClick = () => {
    // FIX 1: Open the global notification drawer (header bell) from the hero quick action too.
    window.dispatchEvent(new CustomEvent('ligtaslto:open-notifs'));
  };

  const handleQuickStatClick = (type: string) => {
    switch (type) {
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
        toast.success('May 842 ulat na galing sa mga kapwa motorista ngayong araw!');
        break;
    }
  };

  return (
    <>
      <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />

      {/* PUNO Alert (Scenario 6) */}
      <AnimatePresence>
        {!isPunoAlertDismissed && adjustedBranches.some((b) => b.is_puno) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="bg-error dark:bg-red-950 text-on-error p-4 rounded-lg flex items-start gap-3 shadow-[0_8px_32px_rgba(25,28,30,0.06)] relative border border-outline-variant/10 dark:border-red-800">
              <span className="material-symbols-outlined flex-shrink-0 mt-0.5 text-on-error" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                warning
              </span>
              <div>
                <h4 className="font-black text-[14px] uppercase tracking-widest mb-1 text-white">May PUNO na Sangay</h4>
                <p className="text-xs font-semibold opacity-90 leading-relaxed max-w-[90%]">
                  Ang {adjustedBranches.filter((b) => b.is_puno).length} sangay malapit sa'yo ay ubos na ang queue numbers ngayong araw. {/* IMPROVEMENT 1: PUNO state now comes from shared data. */}
                </p>
              </div>
              <button onClick={() => setPunoAlertDismissed(true)} className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persona 3A: Decision Widget */}
      <section className="mb-[20px]">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {(decisionBranches.length ? decisionBranches : nearest2).map((b) => {
            const s = getDecisionStatus(b);
            return (
              <button
                key={b.id}
                type="button"
                disabled={b.is_puno === true}
                onClick={() => {
                  if (b.is_puno) return;
                  navigate(`/queue?branch=${encodeURIComponent(b.id)}`);
                }}
                className="flex-shrink-0 w-[155px] h-[110px] rounded-[12px] flex flex-col justify-start border border-outline-variant/10 dark:border-slate-700/30 p-3 bg-surface-container-lowest dark:bg-slate-800 text-left transition-transform active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <div className="text-[13px] font-bold truncate w-full text-on-surface dark:text-slate-100">{b.name}</div>
                <div className={`text-[24px] font-black leading-none mt-2 ${s.tone}`}>{s.word}</div>
                <div className="text-[12px] text-on-surface-variant dark:text-slate-400 mt-1 truncate w-full">{s.reason}</div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end mt-1">
          <button
            type="button"
            onClick={handleSaveDecisionBranches}
            className="text-sm font-bold text-primary"
            aria-label="I-save ang branch"
          >
            i-save ang branch
          </button>
        </div>
      </section>

      {/* Hero Section */}
      <section className="main-hero-gradient rounded-lg p-8 relative overflow-hidden shadow-[0_8px_32px_rgba(25,28,30,0.04)] mb-[20px]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-widest">
              Live Updates
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Alamin bago pumula sa LTO
            </h2>
            <p className="text-white/80 text-sm max-w-[280px] font-medium">
              Tingnan ang haba ng pila at availability ng cards bago bumiyahe.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const el = document.querySelector('.malapit-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else navigate('/branches');
              }}
              className="bg-white text-[#E63946] px-8 py-3 rounded-full font-bold text-sm tracking-wide shadow-lg active:scale-95 transition-transform"
            >
              Tingnan ang Malapit
            </button>
          </div>
        </div>
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/20 px-2 py-1 rounded-full backdrop-blur-md">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isDataStale ? 'bg-amber-500' : 'bg-tertiary'}`} />
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">{isDataStale ? 'Stale' : 'Live'}</span>
        </div>
      </section>

      {/* IMPROVEMENT 2: Dismissible anomaly alert cards between hero and stats (max 2). */}
      {visibleAnomalies.length > 0 && (
        <div className="mb-6 space-y-3">
          {visibleAnomalies.map((b) => (
            <div
              key={b.id}
              className="border border-amber-500/30 dark:border-amber-800/50 bg-amber-500/10 dark:bg-amber-950/60 rounded-xl p-4 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className="material-symbols-outlined text-amber-700 dark:text-amber-400 mt-0.5"
                  style={{ fontVariationSettings: "'FILL' 1" } as any}
                >
                  warning
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-on-surface dark:text-slate-100">
                    May mga nag-ulat ng kahina-hinalang mabilis na transaksyon dito.
                  </div>
                  <div className="text-[13px] font-normal text-on-surface-variant dark:text-slate-400 mt-1">
                    Huwag magbayad ng dagdag sa kahit sino. Official fees lang ang tama.
                  </div>

                  <div className="mt-2 text-[12px] font-bold text-on-surface-variant dark:text-slate-400">
                    Ano ito? ·{' '}
                    <button type="button" onClick={() => openDetails(b)} className="text-primary hover:underline underline-offset-2">
                      Tingnan Branch
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hiddenAnomalyCount > 0 && (
                  <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                    +{hiddenAnomalyCount} {/* IMPROVEMENT 2: "+ count" badge when more anomalies exist. */}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDismissedAnomalies((prev) => ({ ...prev, [b.id]: true }))}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  aria-label="I-dismiss"
                >
                  <span className="material-symbols-outlined text-base text-on-surface dark:text-slate-100">close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BranchDetailsSheet open={isDetailsOpen} branch={selectedBranch} onClose={() => setDetailsOpen(false)} />

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 gap-[12px] mb-[20px]">
        {isLoading && (
          <>
            <SkeletonShimmer className="aspect-square w-full" /> {/* IMPROVEMENT 3: Skeleton for stats card while loading. */}
            <SkeletonShimmer className="aspect-square w-full" /> {/* IMPROVEMENT 3: Skeleton for stats card while loading. */}
            <SkeletonShimmer className="aspect-square w-full" /> {/* IMPROVEMENT 3: Skeleton for stats card while loading. */}
            <SkeletonShimmer className="aspect-square w-full" /> {/* IMPROVEMENT 3: Skeleton for stats card while loading. */}
          </>
        )}
        {!isLoading && (
          <>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleQuickStatClick('plastic')} className="bg-surface-container-lowest dark:bg-slate-800 p-6 rounded-lg shadow-[0_8px_32px_rgba(25,28,30,0.04)] border border-white/50 dark:border-slate-700/30 flex flex-col justify-between aspect-square text-left">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-tertiary/10 dark:bg-teal-900/40 rounded-full">
                  <span className="material-symbols-outlined text-tertiary dark:text-teal-400" style={{ fontVariationSettings: "'FILL' 1" } as any}>check_circle</span>
                </div>
                <span className="text-xs font-bold text-tertiary uppercase tracking-wider">Sapat</span>
              </div>
              <div>
                <div className="text-4xl font-extrabold text-on-surface dark:text-slate-100">{adjustedBranches.filter((b) => b.hasPlasticCards).length || 12}</div>
                <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400 leading-tight">Sangay na may Plastic Cards</div>
              </div>
            </motion.button>

            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleQuickStatClick('wait')} className="bg-surface-container-lowest dark:bg-slate-800 p-6 rounded-lg shadow-[0_8px_32px_rgba(25,28,30,0.04)] border border-white/50 dark:border-slate-700/30 flex flex-col justify-between aspect-square text-left">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-amber-500/10 dark:bg-amber-900/40 rounded-full">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400" style={{ fontVariationSettings: "'FILL' 1" } as any}>schedule</span>
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Moderate</span>
              </div>
              <div>
                <div className="text-4xl font-extrabold text-on-surface dark:text-slate-100">
                  {adjustedBranches.length ? (Math.round(adjustedBranches.reduce((a, c) => a + c.walkinAvgMinutes, 0) / adjustedBranches.length / 60 * 10) / 10) : 2.5}
                </div>
                <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400 leading-tight">Oras Average na Pila</div>
              </div>
            </motion.button>

            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleQuickStatClick('flagged')} className="bg-surface-container-lowest dark:bg-slate-800 p-6 rounded-lg shadow-[0_8px_32px_rgba(25,28,30,0.04)] border border-white/50 dark:border-slate-700/30 flex flex-col justify-between aspect-square text-left">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-primary/10 dark:bg-red-900/40 rounded-full">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" } as any}>report</span>
                </div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Alert</span>
              </div>
              <div>
                <div className="text-4xl font-extrabold text-on-surface dark:text-slate-100">{adjustedBranches.filter(b => b.hasActiveAnomaly).length || 3}</div>
                <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400 leading-tight">Flagged na Sangay</div>
              </div>
            </motion.button>

            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleQuickStatClick('reports')} className="bg-surface-container-lowest dark:bg-slate-800 p-6 rounded-lg shadow-[0_8px_32px_rgba(25,28,30,0.04)] border border-white/50 dark:border-slate-700/30 flex flex-col justify-between aspect-square text-left">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-slate-100 dark:bg-slate-700/60 rounded-full">
                  <span className="material-symbols-outlined text-slate-600 dark:text-slate-400" style={{ fontVariationSettings: "'FILL' 1" } as any}>analytics</span>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
              </div>
              <div>
                <div className="text-4xl font-extrabold text-on-surface dark:text-slate-100">842</div>
                <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400 leading-tight">Kabuuan ng Ulat Ngayon</div>
              </div>
            </motion.button>
          </>
        )}
      </section>

      {/* FIX 3: "Malapit na Sangay" section restored between stats grid and promo card. */}
      <section className="mb-8 malapit-section">
        <div className="flex items-center justify-between px-1 mb-4">
          <h3 className="text-lg font-bold text-on-surface dark:text-slate-100">Malapit na Sangay</h3>
        </div>
        <div className="space-y-4">
          {isLoading && (
            <>
              <SkeletonShimmer className="h-[96px] w-full" /> {/* IMPROVEMENT 3: Skeleton for nearest branch row while loading. */}
              <SkeletonShimmer className="h-[96px] w-full" /> {/* IMPROVEMENT 3: Skeleton for nearest branch row while loading. */}
            </>
          )}
          {!isLoading && nearest2.map((b) => (
            <div key={b.id} className="p-4 bg-surface-container-low dark:bg-slate-800 rounded-2xl mb-4 border border-outline-variant/10 dark:border-slate-700/30">
              {/* 1. TOP SECTION (Row for image, details, queue) */}
              <div className="flex flex-row items-start gap-4">
                {/* LEFT: Image */}
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high mt-1">
                  <img className="w-full h-full object-cover" alt="Branch" src={b.thumbnailUrl} />
                </div>

                {/* MIDDLE: Branch Details (Bolder and Larger Text) */}
                <div className="flex-1 min-w-0 text-left flex flex-col justify-start space-y-0.5">
                  <div className="font-extrabold text-[17px] text-[#0F172A] dark:text-white leading-tight truncate">
                    {b.name || 'LTO Novaliches'}
                  </div>
                  <div className="text-[13px] font-medium text-gray-600 dark:text-gray-400 truncate leading-snug">
                    {b.address || 'Robinsons Novaliches, Quezon City'}
                  </div>
                  <div className="text-[13px] font-medium text-gray-500 dark:text-gray-400 truncate pt-1 flex items-center gap-1">
                    <span>{b.distanceKm ? b.distanceKm.toFixed(1) : '8.7'} km</span>
                    <span>•</span>
                    <span>{b.operatingHours || '08:00-17:00'}</span>
                  </div>
                </div>

                {/* RIGHT: Queue Time */}
                <div className="text-right flex-shrink-0 w-24 flex flex-col items-end">
                  <div className={`text-[19px] font-black leading-none ${waitTone(b.walkinAvgMinutes)}`}>
                    {Math.round(b.walkinAvgMinutes / 60 * 10) / 10}h
                  </div>
                  <div className="mt-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${b.hasPlasticCards ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                      {b.hasPlasticCards ? 'May Plastic' : 'Wala Plastic'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. BOTTOM SECTION (Moved Herd / Arrival Estimate) */}
              {(() => {
                const herd = getArrivalTimeEstimate(b);
                if (!herd) return null;
                return (
                  <div className="mt-4 pt-3 border-t border-amber-500/20 bg-amber-500/5 -mx-4 px-4 -mb-4 rounded-b-2xl pb-3.5">
                    <div className="text-[12px] font-extrabold text-amber-700 dark:text-amber-300 whitespace-normal leading-relaxed text-left flex items-start gap-2">
                      <span className="material-symbols-outlined text-base mt-0.5" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                        groups
                      </span>
                      <span>
                        ~{herd.count} katao papunta — karamihan aabot ng {herd.arrivalTime}. Kung aalis ka ngayon, maaabot mo pa bago sila.
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => navigate('/branches')} className="mt-4 text-sm font-bold text-primary">
          Tingnan Lahat → {/* FIX 3: Link navigates to Branches screen. */}
        </button>
      </section>

      {/* Dark promo card (kept as the only dark surface) */}
      <AnimatePresence>
        {showAnomaly && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, padding: 0, margin: 0 }}
            drag="x"
            dragConstraints={{ left: -100, right: 0 }}
            onDragEnd={(e, { offset }) => {
              if (offset.x < -50) setShowAnomaly(false);
            }}
            className="bg-inverse-surface min-h-[auto] rounded-xl p-[20px] flex items-center justify-between overflow-visible relative mb-[20px] cursor-grab active:cursor-grabbing"
            onClick={() => navigate('/branches')}
          >
            <div className="max-w-[60%] space-y-2 relative z-10 w-full shrink-0">
              <h3 className="text-white text-xl font-bold">Mag-ulat ng Anomalya</h3>
              <p className="text-white/60 text-xs">Maging bahagi ng solusyon. Ipadala ang iyong karanasan sa kahit anong sangay ng LTO.</p>
              <button className="mt-4 text-xs font-bold text-white border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition-colors">
                Magsimula Ngayon
              </button>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-primary/20 backdrop-blur-sm -skew-x-12 translate-x-8"></div>
            <span className="material-symbols-outlined text-white/10 text-9xl absolute -right-4 top-1/2 -translate-y-1/2 select-none">campaign</span>
          </motion.section>
        )}
      </AnimatePresence>
      {/* FIX 1/2: Location + notifications overlays are now global in `Root.tsx` to keep behavior consistent across screens. */}

      {/* Hourly Chart Modal */}
      <AnimatePresence>
        {isChartOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setChartOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full rounded-lg p-6 shadow-2xl border bg-surface-container-lowest dark:bg-slate-900 border-outline-variant/10 dark:border-slate-700/30">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold tracking-tight text-lg text-on-surface">Average Wait Time</h3>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Lahat ng Sangay Ngayon</p>
                </div>
                <button onClick={() => setChartOpen(false)} className="p-2 rounded-full bg-surface-container-low text-on-surface">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <div className="h-40 flex items-end justify-between gap-2 border-b border-dashed pb-2 mb-4 border-outline-variant/50">
                {[40, 60, 80, 100, 60, 30].map((h, i) => (
                  <div key={i} className="w-8 bg-amber-500 rounded-t-md relative group transition-all hover:brightness-110" style={{ height: `${h}%` }}>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded shadow-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white pointer-events-none">
                      {h / 20}h
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-2">
                <span className="text-[10px] font-bold text-outline">8AM</span>
                <span className="text-[10px] font-bold text-outline">11AM</span>
                <span className="text-[10px] font-bold text-outline">2PM</span>
                <span className="text-[10px] font-bold text-outline">5PM</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}