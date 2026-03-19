import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import { toast, Toaster } from 'sonner';
import { Branch, getBranchesMock } from '../data/branches';
import { BranchDetailsSheet } from '../components/BranchDetailsSheet';
import { SkeletonShimmer } from '../components/SkeletonShimmer';

export function Home() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [isChartOpen, setChartOpen] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(true);
  const [isPunoAlertDismissed, setPunoAlertDismissed] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null); // FIX 5: Selected branch drives the details bottom sheet.
  const [isDetailsOpen, setDetailsOpen] = useState(false); // FIX 5: Bottom sheet open state.
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Record<string, boolean>>({}); // IMPROVEMENT 2: Dismiss anomalies for the session only.

  React.useEffect(() => {
    // IMPROVEMENT 3: Load branch data asynchronously so we can show skeletons while "fetching".
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

  const nearest2 = [...branches].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 2); // FIX 3: Top 2 nearest branches by distance.
  const visibleAnomalies = branches
    .filter((b) => b.hasActiveAnomaly && !dismissedAnomalies[b.id])
    .slice(0, 2); // IMPROVEMENT 2: Max 2 visible anomaly cards.
  const hiddenAnomalyCount = Math.max(
    0,
    branches.filter((b) => b.hasActiveAnomaly && !dismissedAnomalies[b.id]).length - visibleAnomalies.length
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
        {!isPunoAlertDismissed && branches.some((b) => b.is_puno) && (
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
                  Ang {branches.filter((b) => b.is_puno).length} sangay malapit sa'yo ay ubos na ang queue numbers ngayong araw. {/* IMPROVEMENT 1: PUNO state now comes from shared data. */}
                </p>
              </div>
              <button onClick={() => setPunoAlertDismissed(true)} className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="main-hero-gradient rounded-lg p-8 relative overflow-hidden shadow-[0_8px_32px_rgba(25,28,30,0.04)] mb-8">
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
              onClick={() => navigate('/branches')}
              className="bg-white text-[#E63946] px-8 py-3 rounded-full font-bold text-sm tracking-wide shadow-lg active:scale-95 transition-transform"
            >
              Tingnan ang Malapit
            </button>
            <button
              onClick={handleAlertsClick}
              className="relative p-3 rounded-full bg-white/20 text-white hover:bg-white/25 transition-colors active:scale-95"
              aria-label="Mga Abiso"
            >
              <span className="material-symbols-outlined">notifications</span>
              {/* FIX 1: Unread dot is handled by the header bell badge now. */}
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('ligtaslto:open-location'))} // FIX 2: Open the global location picker from hero action.
              className="p-3 rounded-full bg-white/20 text-white hover:bg-white/25 transition-colors active:scale-95"
              aria-label="Lokasyon"
            >
              <span className="material-symbols-outlined">location_on</span>
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
            <div key={b.id} className="border border-error/30 dark:border-amber-800/50 bg-error/10 dark:bg-amber-950/60 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-extrabold text-on-surface dark:text-slate-100 truncate">{b.name}</div>
                <div className="text-xs font-semibold text-on-surface-variant dark:text-slate-400 line-clamp-1 mt-0.5">
                  {b.anomalyDescription || 'May aktibong anomaly report.'} {/* IMPROVEMENT 2: One-line anomaly description. */}
                </div>
                <button
                  type="button"
                  onClick={() => openDetails(b)}
                  className="mt-2 text-sm font-bold text-primary"
                >
                  Tingnan Branch {/* IMPROVEMENT 2: Link opens the branch details sheet. */}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {hiddenAnomalyCount > 0 && (
                  <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-error text-white">
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
      <section className="grid grid-cols-2 gap-4 mb-8">
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
            <div className="text-4xl font-extrabold text-on-surface dark:text-slate-100">12</div>
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
            <div className="text-4xl font-extrabold text-on-surface dark:text-slate-100">2.5</div>
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
            <div className="text-4xl font-extrabold text-on-surface dark:text-slate-100">3</div>
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
      <section className="mb-8">
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
            <div key={b.id} className="flex items-center gap-4 p-4 bg-surface-container-low dark:bg-slate-800 rounded-xl">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high">
                <img className="w-full h-full object-cover" alt="Branch" src={b.thumbnailUrl} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-on-surface dark:text-slate-100 truncate">{b.name}</div>
                <div className="text-xs text-on-surface-variant dark:text-slate-400 truncate">
                  {b.distanceKm.toFixed(1)} km • {b.operatingHours} {/* FIX 3: Distance + hours line. */}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-black ${waitTone(b.walkinAvgMinutes)}`}>{Math.round(b.walkinAvgMinutes / 60 * 10) / 10}h</div>
                <div className="mt-1 flex items-center justify-end gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                      b.hasPlasticCards ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
                    }`}
                  >
                    {b.hasPlasticCards ? 'May Plastic' : 'Wala Plastic'} {/* FIX 3: Plastic availability pill. */}
                  </span>
                </div>
              </div>
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
            className="bg-inverse-surface rounded-lg p-8 flex items-center justify-between overflow-hidden relative mb-8 cursor-grab active:cursor-grabbing"
            onClick={() => navigate('/branches')}
          >
            <div className="max-w-[60%] space-y-2 relative z-10">
              <h3 className="text-white text-xl font-bold">Mag-ulat ng Anomalya</h3>
              <p className="text-white/60 text-xs">Maging bahagi ng solusyon. Ipadala ang iyong karanasan sa kahit anong sangay ng LTO.</p>
              <button className="mt-4 text-xs font-bold text-white border border-white/20 px-4 py-2 rounded-full hover:bg-white/10 transition-colors">
                Magsimula Ngayon
              </button>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-primary/20 backdrop-blur-sm -skew-x-12 translate-x-8"></div>
            <span className="material-symbols-outlined text-white/10 text-9xl absolute -right-4 bottom-0 select-none">campaign</span>
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
