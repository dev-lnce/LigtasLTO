import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Activity, FileText, AlertTriangle, Users, ChevronDown, Check, X, MapPin } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import confetti from 'canvas-confetti';
import { CHECK_GEOFENCE, IS_DURING_LUNCH_BREAK, HANDLE_HOLD_TO_SUBMIT } from '../../utils/scenarioGuards';
import { strings } from '../../locales/strings.fil';
import { DEMO_MODE } from '../../config.js';
import { demoBranches } from '../../demoBranches.js';

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

const REAL_BRANCHES: BranchOption[] = [
  {
    id: 'lto-diliman',
    name: 'LTO Diliman District',
    address: 'East Avenue, Quezon City',
    lat: 14.6436,
    lng: 121.045,
  },
  {
    id: 'lto-novaliches',
    name: 'LTO Novaliches',
    address: 'Robinsons Novaliches, Quezon City',
    lat: 14.7216,
    lng: 121.0452,
  },
];

const DEMO_BRANCHES: BranchOption[] = (demoBranches || []).map((b: any) => ({
  ...b,
  isDemo: true,
}));

export function Queue() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [isBranchPickerOpen, setBranchPickerOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchOption>(REAL_BRANCHES[0]);

  const [timerState, setTimerState] = useState<TimerState>('setup');
  const [seconds, setSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  
  const [transactionType, setTransactionType] = useState('License Renewal');
  const [queueNumber, setQueueNumber] = useState('');
  
  // Scenarios State
  const [queueType, setQueueType] = useState<'walk-in' | 'appointment' | null>(null); // Scenario 10
  const [isPreQueue, setIsPreQueue] = useState(false); // Scenario 11
  const [isCompanion, setIsCompanion] = useState(false); // Scenario 8
  const [geofenceError, setGeofenceError] = useState(''); // Scenario 3
  const [isLunchBreak, setIsLunchBreak] = useState(false); // Scenario 7
  const [recoverySession, setRecoverySession] = useState<any>(null); // Scenario 4
  const [isPunoConfirmed, setIsPunoConfirmed] = useState(false); // Scenario 6

  // Submit Form States
  const [hasPlasticReview, setHasPlasticReview] = useState<boolean | null>(null);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitModalOpen, setSubmitModalOpen] = useState(false);
  
  // Offline Sync State
  const [offlineSyncMessage, setOfflineSyncMessage] = useState('');

  // Scenario 2: Milestones
  const [milestones, setMilestones] = useState([
    { id: 'eval', label: 'Evaluation Done', timestamp: null as Date | null },
    { id: 'photo', label: 'Photo/Biometrics Done', timestamp: null as Date | null },
    { id: 'cashier', label: 'Paid Cashier', timestamp: null as Date | null },
    { id: 'release', label: 'Received ID/Papers', timestamp: null as Date | null },
  ]);

  // Handle Mount / Scenario 4 (Recovery) & Background Sync Listener
  useEffect(() => {
    const checkPendingSession = async () => {
      try {
        const res = await fetch(`/api/sessions/pending?device_hash=${DEVICE_HASH}`);
        if (res.ok) {
           const data = await res.json();
           if (data) {
             setRecoverySession(data);
           }
        }
      } catch (e) {} // ignore offline
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

  // Timer & Blackout Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerState === 'active') {
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
  }, [timerState]);

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

    // Scenario 3: Geofence Check
    const geo = await CHECK_GEOFENCE(selectedBranch.lat, selectedBranch.lng);
    if (!geo.allowed) {
      setGeofenceError(geo.error || strings.geofenceError);
      return;
    }
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
      } catch (e) {} // fine to fail if offline
    }
  };

  const openSubmitModal = () => setSubmitModalOpen(true);

  // Milestone Click
  const toggleMilestone = (idx: number) => {
    const updated = [...milestones];
    if (updated[idx].timestamp) {
      updated[idx].timestamp = null;
    } else {
      updated[idx].timestamp = new Date();
      if (idx === 3) { // Scenario 2: Received ID stops timer
        openSubmitModal();
      }
    }
    setMilestones(updated);
  };

  // Scenario 6: Submit PUNO
  const reportPuno = async () => {
    try {
      await fetch(`/api/branches/${selectedBranch.id}/puno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_hash: DEVICE_HASH })
      });
      setIsPunoConfirmed(true);
    } catch (e) {}
  };

  // FINAL SUBMISSION
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const end = new Date();

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
      milestones: milestones.map(m => m.timestamp ? { milestone: m.label, completed_at: m.timestamp.toISOString() } : null).filter(Boolean),
      is_companion_submission: isCompanion
    };

    try {
      if (!navigator.onLine) throw new Error('Offline');
      
      const res = await fetch(isPreQueue ? '/api/prequeue' : '/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('API Error');
    } catch (e) {
      // SCENARIO 1: Offline Logic
      const pendingJson = localStorage.getItem('ligtaslto_pending_submissions') || '[]';
      const pending = JSON.parse(pendingJson);
      pending.push(payload);
      localStorage.setItem('ligtaslto_pending_submissions', JSON.stringify(pending));
      
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = await navigator.serviceWorker.ready;
        try {
          // @ts-ignore
          await reg.sync.register('sync-submissions');
        } catch(e) {}
      }
      setOfflineSyncMessage(strings.offlineBanner);
    }

    setIsSubmitting(false);
    setSubmitModalOpen(false);
    setTimerState('success');
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#E63946', '#10B981', '#F59E0B'] });
  };

  const renderRecoveryModal = () => {
    if (!recoverySession) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
        <div className={`w-full max-w-sm rounded-[24px] p-6 shadow-2xl ${isDark ? 'bg-[#0D1F35] border border-white/10' : 'bg-white'}`}>
          <h3 className={`font-black text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Session Recovered</h3>
          <p className={`text-sm font-medium mb-6 ${isDark ? 'text-blue-200/70' : 'text-gray-600'}`}>
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
        <button onClick={() => setBranchPickerOpen(true)} className={`w-full px-4 py-3.5 rounded-2xl border flex items-center justify-between shadow-sm transition-colors ${isDark ? 'bg-[#162A45] border-white/10' : 'bg-white border-gray-200'}`}>
          <span className={`font-bold text-[15px] ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedBranch.name}</span>
          <ChevronDown size={18} className={isDark ? 'text-blue-200/50' : 'text-gray-400'} />
        </button>
        <p className={`text-[11px] font-medium mt-2 flex items-center gap-1 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>
          <MapPin size={10} /> {selectedBranch.address}
        </p>
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Queue Type (Required)</label>
        <div className="flex gap-3">
           <button onClick={() => setQueueType('walk-in')} className={`flex-1 py-3 rounded-xl border font-bold text-[13px] ${queueType === 'walk-in' ? 'bg-[#E63946] text-white border-[#E63946]' : (isDark ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900')}`}>{strings.queueTypeWalkin}</button>
           <button onClick={() => setQueueType('appointment')} className={`flex-1 py-3 rounded-xl border font-bold text-[13px] ${queueType === 'appointment' ? 'bg-[#10B981] text-white border-[#10B981]' : (isDark ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900')}`}>{strings.queueTypeAppointment}</button>
        </div>
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Queue Number (Optional)</label>
        <input 
           type="text" 
           value={queueNumber}
           onChange={e => setQueueNumber(e.target.value)}
           placeholder="Halimbawa: A-142" 
           className={`w-full px-4 py-3.5 rounded-2xl border font-bold text-[15px] outline-none transition-colors shadow-sm ${isDark ? 'bg-[#0A1626] border-white/10 text-white placeholder:text-blue-200/30' : 'bg-gray-100 border-gray-200 text-gray-900'}`} 
        />
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Transaction Type (Required)</label>
        <div className="flex flex-wrap gap-2.5">
          {['License Renewal', 'MV Registration', 'New License', 'Other'].map(type => (
            <button
              key={type}
              onClick={() => setTransactionType(type)}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all border ${transactionType === type ? 'bg-[#E63946] text-white border-[#E63946]' : (isDark ? 'bg-[#162A45] text-blue-200/70 border-white/10' : 'bg-white text-gray-600')}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
         <input type="checkbox" id="companion" checked={isCompanion} onChange={(e) => setIsCompanion(e.target.checked)} className="w-5 h-5 accent-[#E63946]" />
         <label htmlFor="companion" className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{strings.companionToggle}</label>
      </div>

      {geofenceError && <div className="text-red-500 text-xs font-bold mt-2"><MapPin size={12} className="inline mr-1"/>{geofenceError}</div>}

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
        <motion.div className={`rounded-[28px] p-6 border shadow-xl relative overflow-hidden flex flex-col items-center text-center ${isLunchBreak ? 'border-[#F59E0B] animate-pulse' : (isDark ? 'bg-[#162A45] border-white/10' : 'bg-white border-gray-200')}`}>
          <div className="w-full flex justify-between items-center mb-6">
            <h2 className={`font-bold text-[15px] tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedBranch.name}</h2>
            <div className="bg-transparent border px-3 py-1.5 rounded-full text-xs font-bold shadow-sm backdrop-blur-md">
              <span className={isDark ? 'text-blue-200/70' : 'text-gray-600'}>{transactionType}</span>
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
         <div className="px-6 mb-8">
            <h3 className={`font-bold text-[13px] mb-3 uppercase tracking-wider ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Mga Hakbang</h3>
            <div className="flex flex-col gap-2">
               {milestones.map((m, idx) => (
                  <button 
                     key={m.id} 
                     onClick={() => toggleMilestone(idx)}
                     className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${m.timestamp ? 'bg-[#10B981]/10 border-[#10B981] text-[#10B981]' : (isDark ? 'bg-[#162A45] border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900')}`}
                  >
                     <span className="font-extrabold text-[14px]">{m.label}</span>
                     {m.timestamp ? <CheckCircle2 size={20} className="text-[#10B981]" /> : <div className="w-5 h-5 rounded-full border-2 border-gray-400/30" />}
                  </button>
               ))}
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
           Na-report na rito bilang PUNO. Salamat!
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

  const renderSuccess = () => (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="px-6 flex flex-col items-center justify-center text-center mt-10 pb-20">
      <div className="w-24 h-24 bg-[#10B981] rounded-full flex items-center justify-center text-white mb-6 shadow-[0_0_40px_rgba(16,185,129,0.5)]">
        <Check size={48} strokeWidth={3} />
      </div>
      <h2 className={`font-black tracking-tight text-2xl mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Maraming Salamat!</h2>
      <p className={`font-medium text-sm px-4 mb-4 ${isDark ? 'text-blue-200/70' : 'text-gray-500'}`}>Ang iyong ulat ay malaking tulong sa libu-libong motorista.</p>
      
      {offlineSyncMessage && <p className="text-[#F59E0B] font-bold text-xs mb-6">{offlineSyncMessage}</p>}

      <div className={`w-full p-6 rounded-[24px] border border-dashed mb-8 text-left ${isDark ? 'bg-[#162A45]/50 border-white/20' : 'bg-gray-50 border-gray-300'}`}>
         <span className={`block text-[10px] uppercase font-bold tracking-widest mb-1 ${isDark ? 'text-blue-200/50' : 'text-gray-400'}`}>Total Wait Time</span>
         <span className={`block font-mono font-black text-3xl mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatTime(seconds)}</span>
      </div>

      {/* Scenario 9: Requirements Report */}
      <div className={`w-full p-5 rounded-[20px] border mb-8 text-left ${isDark ? 'bg-[#162A45] border-[#F59E0B]/30' : 'bg-orange-50 border-orange-200'}`}>
         <h4 className={`font-bold text-[14px] mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{strings.requirementsTitle}</h4>
         <div className="flex flex-wrap gap-2">
            {['Updated MedCert', 'Short bond only', 'Extra photocopy'].map(req => (
               <button key={req} onClick={() => {
                  fetch(`/api/branches/${selectedBranch.id}/requirements`, {
                     method: 'POST', headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ requirement_tag: req, device_hash: DEVICE_HASH })
                  });
               }} className="px-3 py-1.5 bg-orange-500/10 text-orange-600 border border-orange-200 rounded-full text-xs font-extrabold">{req}</button>
            ))}
         </div>
      </div>

      <button onClick={() => navigate('/')} className={`w-full py-4 rounded-2xl font-black text-[15px] border ${isDark ? 'bg-[#162A45] text-white hover:bg-[#162A45]/80' : 'bg-white text-gray-900 hover:bg-gray-50'}`}>
        Bumalik sa Home
      </button>
    </motion.div>
  );

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
              className={`relative w-full max-w-sm rounded-[24px] p-5 shadow-2xl border ${isDark ? 'bg-[#0D1F35] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-black tracking-tight text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Pumili ng Branch</h3>
                <button onClick={() => setBranchPickerOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}><X size={16} /></button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-3">
                {DEMO_MODE && DEMO_BRANCHES.length > 0 && (
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
                                <MapPin size={10} /> <span className="truncate">{b.address}</span>
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
                          <MapPin size={10} /> {b.address}
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
          <button onClick={() => navigate(-1)} className={`p-2.5 rounded-full border ${isDark ? 'bg-[#162A45] border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <motion.h1 className={`text-2xl font-black tracking-tight leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {timerState === 'setup' ? 'Ayusin ang Queue' : 'Queue Timer'}
            </motion.h1>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {timerState === 'setup' && renderSetup()}
        {timerState === 'active' && renderActive()}
        {timerState === 'success' && renderSuccess()}
      </AnimatePresence>

      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSubmitModalOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`relative w-full h-[85%] rounded-t-[32px] p-6 shadow-2xl border-t flex flex-col ${isDark ? 'bg-[#0D1F35] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className={`font-black tracking-tight text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Review & Submit</h3>
                <button onClick={() => setSubmitModalOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block flex items-center gap-1.5 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}><Clock size={12} /> Confirm Wait Time</label>
                  <div className={`font-mono text-3xl font-black flex items-center gap-2 ${getTimerColor()}`}>
                    {formatTime(seconds)}
                  </div>
                </div>

                {/* Question */}
                {!isPreQueue && (
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block flex items-center gap-1.5 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}><CreditCard size={12} /> May nakuha ka bang Plastic Card?</label>
                    <div className="flex gap-3">
                      <button onClick={() => setHasPlasticReview(true)} className={`flex-1 border p-3 rounded-[16px] ${hasPlasticReview === true ? 'bg-[#10B981] border-[#10B981] text-white' : (isDark ? 'bg-[#162A45] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900')}`}><span className="font-extrabold text-[13px]">Oo, May Plastic</span></button>
                      <button onClick={() => setHasPlasticReview(false)} className={`flex-1 border p-3 rounded-[16px] ${hasPlasticReview === false ? 'bg-[#E63946] border-[#E63946] text-white' : (isDark ? 'bg-[#162A45] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900')}`}><span className="font-extrabold text-[13px]">Wala, Paper lang</span></button>
                    </div>
                  </div>
                )}
              </div>

              {/* Scenario 12: Hold to submit */}
              <div className="flex-shrink-0 relative">
                  <p className="text-center text-xs font-bold text-gray-500 mb-2">{DEMO_MODE ? 'I-tap para isumite.' : strings.holdToSubmitLabel}</p>
                  <button
                    {...HANDLE_HOLD_TO_SUBMIT(handleFinalSubmit)}
                    disabled={(hasPlasticReview === null && !isPreQueue) || isSubmitting}
                    className={`w-full py-4 rounded-2xl font-black text-[15px] overflow-hidden select-none ${(hasPlasticReview === null && !isPreQueue) ? 'bg-gray-200 text-gray-400' : 'bg-[#E63946] text-white'}`}
                    style={{ WebkitUserSelect: 'none', touchAction: 'none' }}
                  >
                    <div className="relative z-10">{isSubmitting ? 'Nagsu-submit...' : (DEMO_MODE ? 'I-submit' : 'Pindutin nang matagal (2s)')}</div>
                    <div className="absolute top-0 left-0 h-full bg-white/30 transition-all duration-[2000ms] w-0 -z-0 ease-linear [parent.holding_&]:w-full" />
                  </button>

                  <style dangerouslySetInnerHTML={{ __html: `
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
