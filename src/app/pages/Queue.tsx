import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../ThemeContext';
import { useNavigate, useLocation } from 'react-router';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { CHECK_GEOFENCE, IS_DURING_LUNCH_BREAK, HANDLE_HOLD_TO_SUBMIT } from '../../utils/scenarioGuards';
import { strings } from '../../locales/strings.fil';
import { demoBranches } from '../../demoBranches.js';
import { BRANCHES } from '../data/branches';

// DUMMY CONSTANTS
const DEVICE_HASH = 'device-12345'; // in reality: generated / imported
const BRANCH_OPERATING_HOURS = { open: '08:00', close: '17:00', breaks: [{ start: '12:00', end: '13:00', label: 'Lunch Break' }] };

type TimerState = 'setup' | 'active' | 'success';

type BranchOption = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  stats?: {
    hasPlasticCards?: boolean;
    avgWaitWalkIn?: string;
    avgWaitAppointment?: string;
    grade?: string;
    isPuno?: boolean;
    highDemand?: boolean;
    prequeueMinutes?: number;
    reportsToday?: number;
  };
  isDemo?: boolean;
};

// Use the shared mock branch list so URL preselection works for all branches.
const REAL_BRANCHES: BranchOption[] = BRANCHES.map((b: any) => ({
  id: b.id,
  name: b.name,
  address: b.address,
  lat: b.lat,
  lng: b.lng,
  stats: {
    hasPlasticCards: b.hasPlasticCards,
    avgWaitWalkIn: typeof b.walkinAvgMinutes === 'number' ? `${b.walkinAvgMinutes}m` : undefined,
    avgWaitAppointment: typeof b.appointmentAvgMinutes === 'number' ? `${b.appointmentAvgMinutes}m` : undefined,
    grade: b.grade,
    isPuno: b.is_puno,
    highDemand: b.high_demand_warning,
    prequeueMinutes: b.prequeueMinutesBeforeOpen,
    reportsToday: b.reportsToday,
  },
  isDemo: false,
}));

const DEMO_BRANCHES: BranchOption[] = (demoBranches || []).map((b: any) => ({
  ...b,
  isDemo: true,
}));

export function Queue() {
  const { isDark, isDemoMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [isBranchPickerOpen, setBranchPickerOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchOption>(REAL_BRANCHES[0]);

  const [timerState, setTimerState] = useState<TimerState>('setup');
  const [seconds, setSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const [transactionType, setTransactionType] = useState(() => {
    try {
      const saved = localStorage.getItem('ligtaslto_transaction');
      switch (saved) {
        case 'License Renewal':
          return 'License Renewal';
        case 'Vehicle Registration':
          return 'MV Registration';
        case "Driver's License":
          return 'New License';
        case 'Student Permit':
          return 'Other';
        default:
          return 'License Renewal';
      }
    } catch {
      return 'License Renewal';
    }
  });
  const [queueNumber, setQueueNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queueOcrState, setQueueOcrState] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [queueOcrError, setQueueOcrError] = useState<string>('');
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Scenarios State
  const [queueType, setQueueType] = useState<'walk-in' | 'appointment' | null>(null); // Scenario 10
  const [isPreQueue, setIsPreQueue] = useState(false); // Scenario 11
  const [isCompanion, setIsCompanion] = useState(false); // Scenario 8
  const [geofenceError, setGeofenceError] = useState(''); // Scenario 3
  const [isLunchBreak, setIsLunchBreak] = useState(false); // Scenario 7
  const [recoverySession, setRecoverySession] = useState<any>(null); // Scenario 4
  const [isPunoConfirmed, setIsPunoConfirmed] = useState(false); // Scenario 6

  // SECURITY: Persist GPS coordinates so the server can validate submission geofencing (Gap 4).
  const [latestGps, setLatestGps] = useState<{ lat: number; lng: number } | null>(null);

  // Submit Form States
  const [hasPlasticReview, setHasPlasticReview] = useState<boolean | null>(null);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitModalOpen, setSubmitModalOpen] = useState(false);

  // Offline Sync State
  const [offlineSyncMessage, setOfflineSyncMessage] = useState('');

  // Scenario 2: Milestones
  const [milestones, setMilestones] = useState([
    {
      id: 'eval',
      label: 'Tinanggap na ang papel ko sa unang window,',
      icon: 'description',
      contextNote: 'Hintayin ang iyong pangalan o numero na matawag sa evaluation area.\nIhanda ang inyong form o papel para ipakita sa unang bintana.',
      timestamp: null as Date | null,
    },
    {
      id: 'photo',
      label: 'Kinunan na ako ng litrato at fingerprint,',
      icon: 'photo_camera',
      contextNote: 'Siguraduhing malinaw ang litrato at fingerprint.\nKung may hinihinging retake, sundin agad ang instruksyon.',
      timestamp: null as Date | null,
    },
    {
      id: 'cashier',
      label: 'Nabayaran na ko sa cashier window,',
      icon: 'payments',
      contextNote: 'I-check na na-proseso na ang bayad mo sa cashier window.\nHintayin ang resibo o kumpirmasyon bago mag-move.',
      timestamp: null as Date | null,
    },
    {
      id: 'release',
      label: 'Tapos Na',
      icon: 'badge',
      contextNote: 'Hintayin ang iyong pangalan o numero sa release window.\nKapag tumawag na, kunin ang ID o resibo at i-double check.',
      timestamp: null as Date | null,
    },
  ]);

  // Handle Mount / Scenario 4 (Recovery) & Background Sync Listener
  useEffect(() => {
    // FIX 6: Preselect branch when arriving from "Pumila Dito" using URL param (?branch=...).
    try {
      const params = new URLSearchParams(location.search);
      const branchId = params.get('branch');
      if (branchId) {
        const all = [...REAL_BRANCHES, ...DEMO_BRANCHES];
        const match = all.find((b) => b.id === branchId);
        if (match) setSelectedBranch(match);
      }
    } catch { }

    const checkPendingSession = async () => {
      try {
        const res = await fetch(`/api/sessions/pending?device_hash=${DEVICE_HASH}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setRecoverySession(data);
          }
        }
      } catch (e) { } // ignore offline
    };
    checkPendingSession();

    // Register Background Sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        // Just ensuring it's ready. The actual sync registration happens on offline submit.
      });
    }

    const swMessageListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FLUSH_DUE_TO_SYNC') {
        flushOfflineQueue();
      }
    };
    navigator.serviceWorker.addEventListener('message', swMessageListener);
    // Also listen to online event
    window.addEventListener('online', flushOfflineQueue);

    return () => {
      navigator.serviceWorker.removeEventListener('message', swMessageListener);
      window.removeEventListener('online', flushOfflineQueue);
    };
  }, [location.search]);

  // Wake Lock: keep timer screen from auto-dimming for one-handed use.
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setWakeLockActive(Boolean(detail?.active));
    };
    window.addEventListener('ligtaslto:wakeLock-change', onChange as any);
    return () => window.removeEventListener('ligtaslto:wakeLock-change', onChange as any);
  }, []);

  // Scenario 1: Offline submission syncer
  const flushOfflineQueue = async () => {
    const pendingJson = localStorage.getItem('ligtaslto_pending_submissions');
    if (!pendingJson) return;
    const pending = JSON.parse(pendingJson);
    if (pending.length === 0) return;

    let toKeep = [];
    for (const p of pending) {
      try {
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
        if (!res.ok) {
          toKeep.push(p);
        }
      } catch (e) {
        toKeep.push(p);
      }
    }
    localStorage.setItem('ligtaslto_pending_submissions', JSON.stringify(toKeep));
    if (toKeep.length === 0) {
      setOfflineSyncMessage(strings.syncSuccessToast);
      setTimeout(() => setOfflineSyncMessage(''), 4000);
    }
  };

  // Auto-redirect to Home 5 seconds after success
  useEffect(() => {
    if (timerState !== 'success') return;
    const timer = setTimeout(() => navigate('/'), 5000);
    return () => clearTimeout(timer);
  }, [timerState, navigate]);

  // Timer & Blackout Effect
  const isFinalMilestoneDone = Boolean(milestones[3]?.timestamp);
  const currentActiveMilestoneIdxRaw = milestones.findIndex((m) => !m.timestamp);
  const activeMilestoneIdx = currentActiveMilestoneIdxRaw === -1 ? milestones.length - 1 : currentActiveMilestoneIdxRaw;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerState === 'active' && !isFinalMilestoneDone) {
      interval = setInterval(() => {
        // Scenario 7: Check lunch break
        const blackout = IS_DURING_LUNCH_BREAK(BRANCH_OPERATING_HOURS);
        setIsLunchBreak(blackout);

        // If blackout, don't increment visually, but the DB start/end timestamps will still account for it.
        if (!blackout) {
          setSeconds(s => s + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState, isFinalMilestoneDone]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (isPreQueue) return 'text-[#3B82F6]'; // blue for prequeue
    if (isLunchBreak) return 'text-[#F59E0B]'; // yellow for paused
    if (seconds < 7200) return isDark ? 'text-white' : 'text-gray-900';
    if (seconds < 14400) return 'text-[#F59E0B]';
    return 'text-[#E63946]';
  };

  // Scenario 3 & 4: Start Timer Logic
  const handleStartTimer = async (isPre = false) => {
    setIsPreQueue(isPre);

    // Wake Lock API (Persona 1C): keep screen on for the official timer.
    if (!isPre) {
      try {
        (window as any)?.ligtasltoWakeLock?.requestWakeLock?.();
      } catch { }
    }

    // Scenario 3: Geofence Check
    const geo = await CHECK_GEOFENCE(selectedBranch.lat, selectedBranch.lng);
    if (!geo.allowed && !isDemoMode) {
      setGeofenceError(geo.error || strings.geofenceError);
      return;
    }
    // SECURITY: capture starting GPS fix for later submission-time validation.
    if (geo.coords) setLatestGps(geo.coords);
    setGeofenceError('');

    const start = new Date();
    setSessionStartTime(start);
    setTimerState('active');

    if (!isPre) {
      // Scenario 4: Server session tracking
      try {
        await fetch('/api/sessions/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch_id: selectedBranch.id,
            transaction_type: transactionType,
            queue_number: queueNumber,
            device_hash: DEVICE_HASH,
            started_at: start.toISOString()
          })
        });
      } catch (e) { } // fine to fail if offline
    }
  };

  const startQueueNumberOcr = async (file: File) => {
    setQueueOcrState('loading');
    setQueueOcrError('');

    const readBase64 = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          // data:[mime];base64,XXXX -> XXXX
          const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    try {
      const image_base64 = await readBase64();
      // TODO: Backend — add queue_number OCR mode to /api/ocr-check endpoint.
      const res = await fetch('/api/ocr-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64, mode: 'queue_number' }),
      });
      if (!res.ok) throw new Error('OCR_FAILED');
      const data = await res.json();
      const detected = data?.queue_number || data?.queueNumber || data?.queue || '';
      if (!detected || typeof detected !== 'string') throw new Error('OCR_EMPTY');

      setQueueNumber(detected.toUpperCase().trim());
      setQueueOcrState('success');
    } catch {
      setQueueOcrState('failed');
      setQueueOcrError('Hindi namin nabasa ang queue number sa litrato.');
    }
  };

  const onCaptureClicked = () => {
    setQueueOcrState('idle');
    setQueueOcrError('');
    fileInputRef.current?.click();
  };

  const onOcrFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startQueueNumberOcr(file);
  };

  const openSubmitModal = () => setSubmitModalOpen(true);

  // Milestone Click
  const toggleMilestone = (idx: number) => {
    // Persona 1A: only allow tapping the CURRENT active milestone.
    const currentActiveIdx = milestones.findIndex((m) => !m.timestamp);
    const activeIdx = currentActiveIdx === -1 ? milestones.length - 1 : currentActiveIdx;
    if (idx !== activeIdx) return;

    setMilestones((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], timestamp: new Date() };
      return updated;
    });

    if (idx === 3) {
      // Persona 1A: last milestone stops timer + triggers submit flow.
      try {
        (window as any)?.ligtasltoWakeLock?.releaseWakeLock?.();
      } catch { }
      openSubmitModal();
    }
  };

  // Scenario 6: Submit PUNO
  const reportPuno = async () => {
    try {
      // Demo Mode: confirm locally so the UI flow completes even if backend isn't running.
      if (isDemoMode) {
        setIsPunoConfirmed(true);
        return;
      }

      await fetch(`/api/branches/${selectedBranch.id}/puno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_hash: DEVICE_HASH })
      });
      setIsPunoConfirmed(true);
    } catch (e) { }
  };

  // FINAL SUBMISSION
  const handleFinalSubmit = async (e?: any) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (isSubmitting) return; // Prevent double trigger

    setIsSubmitting(true);
    const end = new Date();

    // SECURITY: Fetch GPS at submission time to prevent submit-time location spoofing (Gap 4).
    let gps = latestGps;
    try {
      if (navigator.geolocation) {
        gps = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            () => resolve(latestGps),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        });
      }
    } catch (err) {
      console.warn('GPS fetch failed, falling back to latestGps', err);
    }

    const payload = {
      branch_id: selectedBranch.id,
      transaction_type: transactionType,
      queue_number: queueNumber,
      wait_time_seconds: seconds,
      plastic_card_available: hasPlasticReview,
      user_flags: selectedFlags,
      submitted_at: end.toISOString(),
      started_at: sessionStartTime?.toISOString(),
      device_hash: DEVICE_HASH,
      queue_type: queueType,
      gps_lat: gps?.lat,
      gps_lng: gps?.lng,
      milestones: milestones.map(m => m.timestamp ? { milestone: m.label, completed_at: m.timestamp.toISOString() } : null).filter(Boolean),
      is_companion_submission: isCompanion
    };

    try {
      // In Demo Mode, simulate success without real API call
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        setSubmitModalOpen(false);
        setTimerState('success');
        try { navigator.vibrate?.(200); } catch { }
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#E63946', '#10B981', '#F59E0B'] });
        return;
      }

      if (!navigator.onLine) {
        throw new Error('Offline mode detected');
      }

      const res = await fetch(isPreQueue ? '/api/prequeue' : '/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // Explicitly try to capture specific error
        let errorData = null;
        try { errorData = await res.json(); } catch (jsonErr) { }
        throw new Error(errorData?.message || `API Error: ${res.status}`);
      }

      // SECURITY: Gap 10 - update device tier signal locally after a confirmed server submission.
      try {
        const accessKey = 'ligtaslto_access_tier';
        const prevRaw = localStorage.getItem(accessKey);
        const prev = prevRaw ? JSON.parse(prevRaw) : {};
        const submissionCount = (prev.submissionCount || 0) + 1;
        const tier = submissionCount === 0 ? 1 : submissionCount <= 4 ? 2 : 3;
        localStorage.setItem(accessKey, JSON.stringify({ ...prev, tier, submissionCount, lastFetchedAt: prev.lastFetchedAt || null }));
      } catch (tierError) {
        console.warn('Failed to update tier', tierError);
      }
      setIsSubmitting(false);
      setSubmitModalOpen(false);
      setTimerState('success');
      try { navigator.vibrate?.(200); } catch { }
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#E63946', '#10B981', '#F59E0B'] });
    } catch (e: any) {
      console.error('Submission failed:', e);
      setIsSubmitting(false);

      const isNetworkOrOffline = e.message.includes('Offline') || e.message.includes('Failed to fetch') || e.name === 'TypeError';

      if (isNetworkOrOffline) {
        // SCENARIO 1: Offline Logic
        const pendingJson = localStorage.getItem('ligtaslto_pending_submissions') || '[]';
        const pending = JSON.parse(pendingJson);
        pending.push(payload);
        localStorage.setItem('ligtaslto_pending_submissions', JSON.stringify(pending));

        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            // @ts-ignore
            await reg.sync.register('sync-submissions');
          } catch (swError) {
            console.warn('SW Sync failed:', swError);
          }
        }

        toast.error('Wala kang signal. I-uupload ang ulat mamaya pag may net na.', { duration: 4000 });
      } else {
        // SCENARIO: Validation or Other Server Errors (400, 500)
        toast.error(`Error: ${e.message}`, { duration: 5000 });
      }
    }
  };

  const renderRecoveryModal = () => {
    if (!recoverySession) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-[24px] p-6 shadow-2xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/10 dark:border-slate-700/30">
          <h3 className="font-black text-lg mb-2 text-on-surface dark:text-slate-100">Session Recovered</h3>
          <p className="text-sm font-medium mb-6 text-on-surface-variant dark:text-slate-400">
            {strings.recoveryModalTitle.replace('{time}', new Date(recoverySession.started_at).toLocaleTimeString())}
          </p>
          <input type="time" className="w-full p-4 rounded-xl border mb-4 font-bold" />
          <button onClick={() => setRecoverySession(null)} className="w-full bg-[#E63946] text-white py-3 rounded-xl font-bold">I-submit ang Oras</button>
          <button onClick={() => setRecoverySession(null)} className="w-full mt-2 py-3 rounded-xl font-bold text-gray-500">I-dismiss</button>
        </div>
      </div>
    );
  };

  const renderSetup = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 space-y-6 pb-20">
      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Branch</label>
        <button onClick={() => setBranchPickerOpen(true)} className="w-full px-4 py-3.5 rounded-2xl border border-outline-variant/10 dark:border-slate-700/30 flex items-center justify-between shadow-sm transition-colors bg-surface-container-lowest dark:bg-slate-700">
          <span className="font-bold text-[15px] text-on-surface dark:text-slate-100">{selectedBranch.name}</span>
          <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
        </button>
        <p className="text-[11px] font-medium mt-2 flex items-center gap-1 text-on-surface-variant dark:text-slate-400">
          <span className="material-symbols-outlined text-sm">location_on</span> {selectedBranch.address}
        </p>
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Queue Type (Required)</label>
        <div className="flex gap-3">
          <button
            onClick={() => setQueueType('walk-in')}
            className={`flex-1 py-3 rounded-xl border font-bold text-[13px] ${queueType === 'walk-in' ? 'bg-[#E63946] text-white border-[#E63946]' : (isDark ? 'bg-slate-700 text-slate-300 border-white/10' : 'border-gray-200 text-gray-900')}`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {strings.queueTypeWalkin}
            </span>
          </button>
          <button
            onClick={() => setQueueType('appointment')}
            className={`flex-1 py-3 rounded-xl border font-bold text-[13px] ${queueType === 'appointment' ? 'bg-[#10B981] text-white border-[#10B981]' : (isDark ? 'bg-slate-700 text-slate-300 border-white/10' : 'border-gray-200 text-gray-900')}`}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {strings.queueTypeAppointment}
            </span>
          </button>
        </div>
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>
          Queue Slip (Optional)
        </label>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          className="hidden"
          onChange={onOcrFileSelected}
        />

        <button
          type="button"
          onClick={onCaptureClicked}
          className="w-full min-h-[56px] rounded-2xl border-2 border-outline-variant/30 bg-transparent text-on-surface dark:text-slate-100 font-black text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" } as any}>photo_camera</span>
          I-litrato ang iyong slip
        </button>

        {queueOcrState === 'loading' && (
          <div className="mt-2 text-[11px] font-bold text-on-surface-variant dark:text-slate-400">
            Sinusuri ang litrato...
          </div>
        )}

        {queueOcrState === 'success' && queueNumber && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex-1 px-4 py-2 rounded-full bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant/10 dark:border-slate-700/30 text-center font-extrabold text-[14px] text-on-surface dark:text-slate-100">
              {queueNumber}
            </div>
            <button
              type="button"
              onClick={onCaptureClicked}
              className="shrink-0 text-[12px] font-black text-primary dark:text-blue-300 underline underline-offset-2"
            >
              Mali ba?
            </button>
          </div>
        )}

        {queueOcrState === 'failed' && (
          <div className="mt-3">
            <input
              type="text"
              value={queueNumber}
              onChange={(e) => setQueueNumber(e.target.value)}
              placeholder="Hal: B-078"
              className="w-full px-4 py-3.5 rounded-2xl border font-bold text-[15px] outline-none transition-colors shadow-sm bg-surface-container-lowest dark:bg-slate-700 border-outline-variant/10 dark:border-slate-700/30 text-on-surface dark:text-slate-100 placeholder:text-on-surface-variant/60 dark:placeholder:text-slate-500"
            />
            {queueOcrError && (
              <div className="mt-2 text-[11px] font-bold text-error dark:text-rose-300">
                {queueOcrError}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Transaction Type (Required)</label>
        <div className="flex flex-wrap gap-2.5">
          {['License Renewal', 'MV Registration', 'New License', 'Other'].map(type => (
            <button
              key={type}
              onClick={() => setTransactionType(type)}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all border ${transactionType === type ? 'bg-[#E63946] text-white border-[#E63946]' : (isDark ? 'bg-slate-700 text-slate-200 border-white/10' : 'bg-white text-gray-600')}`}
            >
              <span className="inline-flex items-center gap-2">
                {type}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <input type="checkbox" id="companion" checked={isCompanion} onChange={(e) => setIsCompanion(e.target.checked)} className="w-5 h-5 accent-[#E63946]" />
        <label htmlFor="companion" className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{strings.companionToggle}</label>
      </div>

      {geofenceError && (
        <div className="text-error text-xs font-bold mt-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">location_off</span>
          {geofenceError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 mt-4">
        <button
          onClick={() => handleStartTimer(false)}
          disabled={!queueType}
          className="w-full bg-[#E63946] disabled:opacity-50 text-white py-4 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Simulan ang Timer
        </button>
        <button
          onClick={() => handleStartTimer(true)}
          disabled={!queueType}
          className="w-full bg-transparent border-2 border-[#3B82F6] text-[#3B82F6] font-bold py-4 rounded-2xl text-[14px] active:scale-[0.98]"
        >
          {strings.prequeueBtn}
        </button>
      </div>
    </motion.div>
  );

  const renderActive = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-24">
      {offlineSyncMessage && (
        <div className="mx-6 mb-4 bg-[#F59E0B] text-black font-bold p-3 rounded-lg text-sm text-center shadow-lg">
          {offlineSyncMessage}
        </div>
      )}

      {isPreQueue && (
        <div className="mx-6 mb-4 border border-[#3B82F6] bg-[#3B82F6]/10 p-3 rounded-lg text-[13px] font-bold text-[#3B82F6] text-center">
          {strings.prequeueBanner}
        </div>
      )}

      {isLunchBreak && (
        <div className="mx-6 mb-4 border border-[#F59E0B] bg-[#F59E0B]/10 p-3 rounded-lg text-[13px] font-bold text-[#F59E0B] text-center">
          {strings.lunchBreakBanner.replace('{start}', '12:00').replace('{end}', '1:00')}
        </div>
      )}

      <div className="px-6 mb-5">
        <motion.div className={`rounded-[28px] p-6 border shadow-xl relative overflow-hidden flex flex-col items-center text-center ${isLunchBreak ? 'border-[#F59E0B] animate-pulse' : (isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200')}`}>
          <div className="w-full flex justify-between items-center mb-6 gap-3">
            <div className={`flex flex-col items-start min-w-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <div className="font-[500] text-[13px] truncate w-full text-left leading-tight">{selectedBranch.name}</div>
              <div className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">{transactionType}</div>
            </div>
            <div className="flex shrink-0">
              {wakeLockActive && (
                <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold select-none border border-amber-500/30">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                    screen_lock_portrait
                  </span>
                  Screen aktibo
                </div>
              )}
            </div>
          </div>

          <div className={`mb-2 w-full flex justify-center items-center font-mono text-[3.5rem] leading-none font-black tracking-tighter ${getTimerColor()}`}>
            {formatTime(seconds)}
          </div>
          <p className={`text-xs font-bold uppercase tracking-widest mb-8 ${isDark ? 'text-blue-200/40' : 'text-gray-400'}`}>Oras ng paghihintay</p>
        </motion.div>
      </div>

      {/* Scenario 2: Milestones Checklist */}
      {!isPreQueue && (
        <div className="mb-8">
          <style>{`
            @keyframes pulse-ring {
              0%,100%{box-shadow:0 0 0 0 rgba(183,16,42,0.3)}
              50%{box-shadow:0 0 0 8px rgba(183,16,42,0)}
            }
          `}</style>
          <div className="flex flex-col gap-3 p-4">
            {milestones.map((m, idx) => {
              const isCompleted = Boolean(m.timestamp);
              const isActive = idx === activeMilestoneIdx && !isCompleted;
              const isPending = !isCompleted && !isActive && idx > activeMilestoneIdx;
              const isDisabled = !isActive;

              const buttonClass = isActive
                ? 'w-full min-h-[72px] rounded-[16px] flex items-center gap-4 px-4 py-3 bg-[#B7102A] text-white'
                : isCompleted
                  ? 'w-full min-h-[72px] rounded-[16px] flex items-center gap-4 px-4 py-3 bg-surface-container-lowest dark:bg-slate-800 text-on-surface-variant dark:text-slate-400'
                  : 'w-full min-h-[72px] rounded-[16px] flex items-center gap-4 px-4 py-3 bg-surface-container-lowest dark:bg-slate-800 text-tertiary opacity-40 pointer-events-none';

              const icon = isCompleted ? 'check_circle' : (m as any).icon;
              const iconClass = isActive
                ? 'text-white'
                : isCompleted
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-tertiary';

              const noteColor = isActive
                ? 'text-white/80'
                : 'text-on-surface-variant dark:text-slate-400';

              const contextNote = (m as any).contextNote as string | undefined;
              const noteLines = contextNote ? contextNote.split('\n') : [];

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMilestone(idx)}
                  disabled={isDisabled}
                  className={buttonClass}
                  style={isActive ? ({ animation: 'pulse-ring 2s ease-in-out infinite' } as any) : undefined}
                >
                  <span
                    className={`material-symbols-outlined text-[28px] flex-shrink-0 ${iconClass}`}
                    style={{ fontVariationSettings: "'FILL' 1" } as any}
                  >
                    {icon}
                  </span>

                  <div className="flex flex-col min-w-0 items-start text-left w-full pr-1">
                    <div className="text-[15px] font-bold leading-tight break-words">{m.label}</div>
                    <div className={`text-[11px] font-normal italic leading-snug mt-1 opacity-80 line-clamp-2 w-full ${noteColor}`}>
                      {noteLines.map((ln, i) => (
                        <React.Fragment key={i}>
                          {ln}
                          {i < noteLines.length - 1 && ' '}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scenario 6: PUNO Button */}
      {!isPreQueue && !isPunoConfirmed && (
        <div className="px-6 mb-8 mt-4">
          <button onClick={reportPuno} className="w-full py-3 border border-red-500 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-colors">
            {strings.punoReportBtn}
          </button>
        </div>
      )}
      {isPunoConfirmed && (
        <div className="mx-6 mb-8 border border-red-500 bg-red-500 text-white p-3 rounded-lg text-[13px] font-bold text-center">
          <span className="inline-flex items-center justify-center gap-2">
            Na-report na rito bilang PUNO.
          </span>{' '}
          Salamat!
        </div>
      )}

      {/* Force override submit if milestones are skipped */}
      <div className="px-6">
        <button
          onClick={openSubmitModal}
          className="w-full bg-gray-600 text-white py-4 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Force Submit / Tapos na ako
        </button>
      </div>
    </motion.div>
  );

  const renderSuccess = () => {
    // Format wait time
    const totalSec = seconds;
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const waitTimeText = hrs > 0 ? `${hrs} oras ${mins} minuto` : `${mins} minuto`;

    return (
      <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-900 text-center flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-[80px] h-[80px] mb-6 flex items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="38" fill="#10B981" fillOpacity="0.15" />
              <circle cx="40" cy="40" r="38" stroke="#10B981" strokeWidth="4" />
              <path d="M27 41.5L36.2 50.7L53.5 33.4" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="text-[20px] font-bold leading-snug text-slate-900 dark:text-slate-100 mb-3">
            Tapos ka na! Salamat sa iyong tulong.
          </div>

          <div className="text-[18px] font-semibold text-on-surface-variant dark:text-slate-400 mb-8">
            Naghintay ka ng {waitTimeText}
          </div>

          <div className="w-full mt-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-[15px]"
            >
              Bumalik sa Home
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderRecoveryModal()}

      <AnimatePresence>
        {isBranchPickerOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setBranchPickerOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative w-full max-w-sm rounded-[24px] p-5 shadow-2xl border ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-black tracking-tight text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Pumili ng Branch</h3>
                <button onClick={() => setBranchPickerOpen(false)} className="p-2 rounded-full bg-surface-container-low text-on-surface">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-3">
                {isDemoMode && DEMO_BRANCHES.length > 0 && (
                  <div>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-[#F4A261]' : 'text-amber-700'}`}>Demo Branches</div>
                    <div className="flex flex-col gap-2">
                      {DEMO_BRANCHES.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBranch(b);
                            setGeofenceError('');
                            setIsPunoConfirmed(false);
                            setBranchPickerOpen(false);
                          }}
                          className={`text-left px-4 py-3 rounded-2xl border transition-colors ${isDark ? 'bg-[#162A45] border-white/10 hover:bg-white/5 text-white' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-extrabold text-[14px] truncate">{b.name}</div>
                              <div className={`text-[11px] font-medium mt-0.5 flex items-center gap-1 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>
                                <span className="material-symbols-outlined text-sm">location_on</span> <span className="truncate">{b.address}</span>
                              </div>
                            </div>
                            {b.stats?.grade && (
                              <div className={`px-2 py-1 rounded-full text-[10px] font-black border ${isDark ? 'border-white/10 text-white/90' : 'border-gray-200 text-gray-700'}`}>
                                {b.stats.grade}
                              </div>
                            )}
                          </div>
                          {(b.stats?.avgWaitWalkIn || b.stats?.hasPlasticCards !== undefined) && (
                            <div className={`mt-2 text-[10px] font-bold flex flex-wrap gap-2 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>
                              {b.stats?.avgWaitWalkIn && <span>Walk-in: {b.stats.avgWaitWalkIn}</span>}
                              {b.stats?.hasPlasticCards !== undefined && (
                                <span>{b.stats.hasPlasticCards ? 'May Plastic' : 'Walang Plastic'}</span>
                              )}
                              {b.stats?.reportsToday !== undefined && <span>Reports: {b.stats.reportsToday}</span>}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-blue-200/40' : 'text-gray-500'}`}>Branches</div>
                  <div className="flex flex-col gap-2">
                    {REAL_BRANCHES.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBranch(b);
                          setGeofenceError('');
                          setIsPunoConfirmed(false);
                          setBranchPickerOpen(false);
                        }}
                        className={`text-left px-4 py-3 rounded-2xl border transition-colors ${isDark ? 'bg-[#162A45] border-white/10 hover:bg-white/5 text-white' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'}`}
                      >
                        <div className="font-extrabold text-[14px]">{b.name}</div>
                        <div className={`text-[11px] font-medium mt-0.5 flex items-center gap-1 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>
                          <span className="material-symbols-outlined text-sm">location_on</span> {b.address}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="px-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              try {
                (window as any)?.ligtasltoWakeLock?.releaseWakeLock?.();
              } catch { }
              navigate(-1);
            }}
            className={`p-2.5 rounded-full border ${isDark ? 'bg-slate-800 border-white/5 text-slate-100' : 'bg-white border-gray-200 text-gray-900'}`}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <motion.h1 className={`text-2xl font-black tracking-tight leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {timerState === 'setup' ? 'Ayusin ang Queue' : 'Queue Timer'}
            </motion.h1>
          </div>
        </div>
      </header>

      <div className="relative z-[1]">
        <AnimatePresence mode="wait">
          {timerState === 'setup' && renderSetup()}
          {timerState === 'active' && renderActive()}
          {timerState === 'success' && renderSuccess()}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            // Backdrop does NOT close modal (prevent accidental dismissal)
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`relative w-full h-[85%] rounded-t-[32px] p-6 shadow-2xl border-t flex flex-col ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-black tracking-tight text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Review & Submit</h3>
                <button onClick={() => setSubmitModalOpen(false)} className="p-2 rounded-full bg-slate-700 text-slate-100">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest mb-2 block flex items-center gap-1.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">schedule</span> Confirm Wait Time
                  </label>
                  <div className={`font-mono text-3xl font-black flex items-center gap-2 ${getTimerColor()}`}>
                    {formatTime(seconds)}
                  </div>
                </div>

                {/* Question */}
                {!isPreQueue && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest mb-3 block flex items-center gap-1.5 text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">credit_card</span>
                      <span className="inline-flex items-center gap-1">
                        May nakuha ka bang Plastic Card?
                      </span>
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setHasPlasticReview(true)}
                        className={`flex-1 h-[80px] rounded-[20px] bg-emerald-500 dark:bg-emerald-700 text-white border border-emerald-500/30 flex flex-col items-center justify-center gap-1.5 active:scale-[0.99] transition-transform ${hasPlasticReview === true ? 'ring-2 ring-white/30' : ''
                          }`}
                      >
                        <svg width="44" height="28" viewBox="0 0 44 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <rect x="2" y="3" width="40" height="22" rx="5" fill="rgba(255,255,255,0.95)" />
                          <rect x="2" y="3" width="40" height="7" rx="5" fill="rgba(16,185,129,0.25)" />
                          <rect x="10" y="14" width="18" height="3" rx="1.5" fill="#10B981" fillOpacity="0.9" />
                          <rect x="10" y="18" width="26" height="3" rx="1.5" fill="#10B981" fillOpacity="0.9" />
                        </svg>
                        <div className="text-[14px] font-bold leading-tight">May Plastic Card</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHasPlasticReview(false)}
                        className={`flex-1 h-[80px] rounded-[20px] bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant/10 dark:border-slate-700 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center gap-1.5 active:scale-[0.99] transition-transform ${hasPlasticReview === false ? 'ring-2 ring-black/10 dark:ring-white/10' : ''
                          }`}
                      >
                        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path
                            d="M10 3.5H22.5L26.5 7.5V27.5C26.5 28.6 25.6 29.5 24.5 29.5H10C8.9 29.5 8 28.6 8 27.5V5.5C8 4.4 8.9 3.5 10 3.5Z"
                            fill="rgba(255,255,255,0.95)"
                            stroke="rgba(148,163,184,0.8)"
                            strokeWidth="1.5"
                          />
                          <path d="M12 12H22" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 16H20" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 20H18" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <div className="text-[14px] font-bold leading-tight">Paper Receipt lang</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Scenario 12: Hold to submit */}
              <div className="flex-shrink-0 relative">
                <p className="text-center text-xs font-bold text-gray-500 mb-2">{isDemoMode ? 'I-tap para isumite.' : strings.holdToSubmitLabel}</p>
                <style dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .submit-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 6px; }
                  `}} />
                <button
                  id="submit-btn"
                  onClick={(e) => {
                    if (isDemoMode) handleFinalSubmit(e);
                  }}
                  {...(isDemoMode ? {} : HANDLE_HOLD_TO_SUBMIT(handleFinalSubmit))}
                  disabled={(hasPlasticReview === null && !isPreQueue) || isSubmitting}
                  className={`w-full py-4 rounded-2xl font-black text-[15px] overflow-hidden select-none transition-all ${(hasPlasticReview === null && !isPreQueue)
                      ? 'bg-gray-200 text-gray-400 opacity-40 cursor-not-allowed'
                      : isSubmitting
                        ? 'bg-[#E63946] text-white opacity-80 cursor-not-allowed'
                        : 'bg-[#E63946] text-white'
                    }`}
                  style={{ WebkitUserSelect: 'none', touchAction: 'none' }}
                >
                  <div className="relative z-10">
                    {isSubmitting ? (<><span className="submit-spinner"></span>Nagsu-submit...</>) : (isDemoMode ? 'I-submit' : 'Pindutin nang matagal (2s)')}
                  </div>
                  <div className="absolute top-0 left-0 h-full bg-white/30 transition-all duration-[2000ms] w-0 -z-0 ease-linear [parent.holding_&]:w-full" />
                </button>

                <style dangerouslySetInnerHTML={{
                  __html: `
                    button.holding div.absolute { width: 100%; transition: width 2s linear; }
                    button:not(.holding) div.absolute { width: 0%; transition: width 0.1s linear; }
                  `}} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
