import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Activity, FileText, AlertTriangle, Users, ChevronDown, Check, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useNavigate } from 'react-router';
import confetti from 'canvas-confetti';

type TimerState = 'setup' | 'active' | 'success';

export function Queue() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [timerState, setTimerState] = useState<TimerState>('setup');
  const [seconds, setSeconds] = useState(0);
  const [transactionType, setTransactionType] = useState('License Renewal');
  const [plasticSubmitted, setPlasticSubmitted] = useState(false);
  const [isSubmitModalOpen, setSubmitModalOpen] = useState(false);

  // Submit Form States
  const [hasPlasticReview, setHasPlasticReview] = useState<boolean | null>(null);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerState === 'active') {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
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
    if (seconds < 7200) return isDark ? 'text-white' : 'text-gray-900'; // < 2h
    if (seconds < 14400) return 'text-[#F59E0B]'; // 2-4h
    return 'text-[#E63946]'; // > 4h
  };

  const startTimer = () => setTimerState('active');

  const openSubmitModal = () => {
    setSubmitModalOpen(true);
  };

  const handleFinalSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitModalOpen(false);
      setTimerState('success');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E63946', '#10B981', '#F59E0B']
      });
    }, 1500);
  };

  const renderSetup = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 space-y-6 pb-20">
      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Branch</label>
        <button className={`w-full px-4 py-3.5 rounded-2xl border flex items-center justify-between shadow-sm transition-colors ${isDark ? 'bg-[#162A45] border-white/10' : 'bg-white border-gray-200'}`}>
          <span className={`font-bold text-[15px] ${isDark ? 'text-white' : 'text-gray-900'}`}>LTO Diliman District</span>
          <ChevronDown size={18} className={isDark ? 'text-blue-200/50' : 'text-gray-400'} />
        </button>
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Queue Number (Optional)</label>
        <input type="text" placeholder="Halimbawa: A-142" className={`w-full px-4 py-3.5 rounded-2xl border font-bold text-[15px] outline-none transition-colors shadow-sm ${isDark ? 'bg-[#0A1626] border-white/10 text-white placeholder:text-blue-200/30 focus:border-white/30' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-400'}`} />
      </div>

      <div>
        <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Transaction Type (Required)</label>
        <div className="flex flex-wrap gap-2.5">
          {['License Renewal', 'MV Registration', 'New License', 'Other'].map(type => (
            <button
              key={type}
              onClick={() => setTransactionType(type)}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all border ${transactionType === type ? 'bg-[#E63946] text-white border-[#E63946] shadow-lg shadow-[#E63946]/20' : (isDark ? 'bg-[#162A45] text-blue-200/70 border-white/10' : 'bg-white text-gray-600 border-gray-200')}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={startTimer}
        className="w-full mt-4 bg-[#E63946] hover:bg-[#b32b37] text-white py-4 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(230,57,70,0.4)] transition-all active:scale-[0.98]"
      >
        Simulan ang Timer
      </button>
    </motion.div>
  );

  const renderActive = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-24">
      <div className="px-6 mb-5">
        <motion.div className={`rounded-[28px] p-6 border shadow-xl relative overflow-hidden flex flex-col items-center text-center ${isDark ? 'bg-[#162A45] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="w-full flex justify-between items-center mb-6">
            <h2 className={`font-bold text-[15px] tracking-tight text-left leading-tight max-w-[65%] ${isDark ? 'text-white' : 'text-gray-900'}`}>LTO Diliman District</h2>
            <div className="bg-transparent border px-3 py-1.5 rounded-full text-xs font-bold shadow-sm backdrop-blur-md">
              <span className={isDark ? 'text-blue-200/70' : 'text-gray-600'}>{transactionType}</span>
            </div>
          </div>

          <div className={`mb-2 w-full flex justify-center items-center font-mono text-[3.5rem] leading-none font-black tracking-tighter ${getTimerColor()}`}>
            {formatTime(seconds)}
          </div>

          <p className={`text-xs font-bold uppercase tracking-widest mb-8 ${isDark ? 'text-blue-200/40' : 'text-gray-400'}`}>Oras ng paghihintay</p>

          <button
            onClick={openSubmitModal}
            className="w-full bg-[#E63946] hover:bg-[#b32b37] text-white py-4 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(230,57,70,0.4)] transition-all active:scale-[0.98]"
          >
            <CheckCircle2 size={20} strokeWidth={3} /> Tapos Na — I-submit
          </button>
        </motion.div>
      </div>

      {/* Branch Stats Mini Card */}
      <div className="px-6 mb-5">
        <motion.div className={`rounded-[20px] p-4 border flex items-center gap-4 ${isDark ? 'bg-[#162A45]/60 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
          <div className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center shadow-inner flex-shrink-0 ${isDark ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40' : 'bg-amber-50 border-amber-200'}`}>
            <span className="text-[#F59E0B] font-black text-xl leading-none">C</span>
            <span className={`text-[8px] font-bold uppercase mt-0.5 ${isDark ? 'text-[#F59E0B]/60' : 'text-amber-600/80'}`}>Grade</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            {[{ i: Clock, t: '2.5h Avg' }, { i: CreditCard, t: '60% Cards' }, { i: Activity, t: '124 Reports' }].map((x, idx) => (
              <div key={idx} className={`border px-3 py-1.5 rounded-full flex items-center gap-1.5 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-300 shadow-sm'}`}>
                <x.i size={12} className={isDark ? 'text-blue-200/60' : 'text-gray-500'} />
                <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-gray-700'}`}>{x.t}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Plastic Status Quick Submit */}
      <div className="px-6 mb-8">
        <h3 className={`font-bold text-[13px] mb-3 uppercase tracking-wider ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Quick Update: May Plastic Ba?</h3>
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            disabled={plasticSubmitted}
            onClick={() => setPlasticSubmitted(true)}
            className={`border p-4 rounded-[20px] flex flex-col items-center justify-center gap-2 transition-colors ${plasticSubmitted ? (isDark ? 'opacity-50 bg-[#10B981]/5 border-[#10B981]/10' : 'opacity-50 bg-gray-50 border-gray-200') : (isDark ? 'bg-[#10B981]/10 border-[#10B981]/30 hover:bg-[#10B981]/20' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 shadow-sm')}`}
          >
            <CreditCard size={24} className={isDark ? 'text-[#10B981]' : 'text-emerald-600'} />
            <span className={`font-extrabold text-[13px] ${isDark ? 'text-[#10B981]' : 'text-emerald-700'}`}>{plasticSubmitted ? 'Salamat!' : 'May Plastic'}</span>
          </motion.button>
          <motion.button
            disabled={plasticSubmitted}
            onClick={() => setPlasticSubmitted(true)}
            className={`border p-4 rounded-[20px] flex flex-col items-center justify-center gap-2 transition-colors shadow-inner ${plasticSubmitted ? (isDark ? 'opacity-50 bg-[#0A1626]/50 border-white/5' : 'opacity-50 bg-gray-50 border-gray-200') : (isDark ? 'bg-[#0A1626] border-white/10 hover:bg-white/5' : 'bg-white border-gray-300 hover:bg-gray-50')}`}
          >
            <FileText size={24} className={isDark ? 'text-blue-200/60' : 'text-gray-500'} />
            <span className={`font-bold text-[13px] ${isDark ? 'text-blue-200/80' : 'text-gray-700'}`}>{plasticSubmitted ? 'Salamat!' : 'Wala, Paper lang'}</span>
          </motion.button>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="px-6">
        <h3 className={`font-bold text-[15px] mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Users size={16} className={isDark ? 'text-blue-200/50' : 'text-gray-500'} /> Mga Huling Ulat ng Pila
        </h3>
        <div className="flex flex-col gap-3">
          <motion.div className={`border p-4 rounded-[16px] flex items-center justify-between ${isDark ? 'bg-[#162A45] border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className={`border px-2 py-1 rounded font-mono font-bold text-xs ${isDark ? 'bg-[#0A1626] border-white/10 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}>A-140</div>
              <div>
                <p className={`font-bold text-[13px] leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{transactionType}</p>
                <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>5 min nakalipas</p>
              </div>
            </div>
            <div className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>01:45:20</div>
          </motion.div>

          {/* Anomaly Flagged Report */}
          <motion.div className={`border p-4 rounded-[16px] flex items-center justify-between relative overflow-hidden cursor-pointer ${isDark ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40' : 'bg-amber-50 border-amber-200'}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F59E0B]" />
            <div className="flex items-center gap-3 pl-1">
              <div className={`border px-2 py-1 rounded font-mono font-bold text-xs ${isDark ? 'bg-[#F59E0B]/20 border-[#F59E0B]/30 text-[#F59E0B]' : 'bg-amber-100 border-amber-300 text-amber-700'}`}>B-089</div>
              <div>
                <p className={`font-extrabold text-[13px] leading-tight flex items-center gap-1.5 ${isDark ? 'text-[#F59E0B]' : 'text-amber-700'}`}>
                  <AlertTriangle size={12} strokeWidth={3} /> Bagong Lisensya
                </p>
                <p className={`text-[10px] font-bold mt-0.5 ${isDark ? 'text-[#F59E0B]/70' : 'text-amber-600'}`}>May fixer na nakita</p>
              </div>
            </div>
            <div className={`font-black text-sm ${isDark ? 'text-[#F59E0B]' : 'text-amber-700'}`}>00:15:00</div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );

  const renderSuccess = () => (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="px-6 flex flex-col items-center justify-center text-center mt-10">
      <div className="w-24 h-24 bg-[#10B981] rounded-full flex items-center justify-center text-white mb-6 shadow-[0_0_40px_rgba(16,185,129,0.5)]">
        <Check size={48} strokeWidth={3} />
      </div>
      <h2 className={`font-black tracking-tight text-2xl mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Maraming Salamat!</h2>
      <p className={`font-medium text-sm px-4 mb-8 leading-relaxed ${isDark ? 'text-blue-200/70' : 'text-gray-500'}`}>Ang iyong ulat ay malaking tulong sa libu-libong motorista ngayong araw.</p>

      <div className={`w-full p-6 rounded-[24px] border border-dashed mb-8 text-left ${isDark ? 'bg-[#162A45]/50 border-white/20' : 'bg-gray-50 border-gray-300'}`}>
        <span className={`block text-[10px] uppercase font-bold tracking-widest mb-1 ${isDark ? 'text-blue-200/50' : 'text-gray-400'}`}>Total Wait Time</span>
        <span className={`block font-mono font-black text-3xl mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatTime(seconds)}</span>

        <span className={`block text-[10px] uppercase font-bold tracking-widest mb-1 ${isDark ? 'text-blue-200/50' : 'text-gray-400'}`}>Branch</span>
        <span className={`block font-bold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>LTO Diliman District</span>
      </div>

      <button
        onClick={() => navigate('/')}
        className={`w-full py-4 rounded-2xl font-black text-[15px] border transition-colors ${isDark ? 'bg-[#162A45] border-white/10 text-white hover:bg-[#162A45]/80' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'}`}
      >
        Bumalik sa Home
      </button>
    </motion.div>
  );

  return (
    <>
      <header className="px-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className={`p-2.5 rounded-full border transition-colors ${isDark ? 'bg-[#162A45] border-white/5 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-100'}`}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <motion.h1 className={`text-2xl font-black tracking-tight leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {timerState === 'setup' ? 'Ayusin ang Queue' : 'Queue Timer'}
            </motion.h1>
            {timerState === 'setup' && <motion.p className={`text-xs font-medium ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Ilagay ang detalye para magsimula</motion.p>}
            {timerState === 'active' && <motion.p className={`text-xs font-medium ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}>Aktibong subaybay ng oras</motion.p>}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {timerState === 'setup' && renderSetup()}
        {timerState === 'active' && renderActive()}
        {timerState === 'success' && renderSuccess()}
      </AnimatePresence>

      {/* Review & Submit Bottom Sheet Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[3rem]"
              onClick={() => setSubmitModalOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`relative w-full h-[85%] rounded-t-[32px] p-6 shadow-2xl border-t flex flex-col ${isDark ? 'bg-[#0D1F35] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className="w-12 h-1.5 bg-gray-400/30 rounded-full mx-auto mb-6 flex-shrink-0" />
              <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h3 className={`font-black tracking-tight text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Review & Submit</h3>
                <button onClick={() => setSubmitModalOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6 scrollbar-hide">
                {/* Step 1: Confirm Wait Time */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-widest mb-2 block flex items-center gap-1.5 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}><Clock size={12} /> Confirm Wait Time</label>
                  <div className={`font-mono text-3xl font-black flex items-center gap-2 ${getTimerColor()}`}>
                    {formatTime(seconds)}
                    <span className="text-sm font-bold opacity-50 bg-[#E63946]/10 px-2 py-1 rounded">Mula app load</span>
                  </div>
                </div>

                {/* Step 2: Plastic Card Question */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block flex items-center gap-1.5 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}><CreditCard size={12} /> May nakuha ka bang Plastic Card?</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setHasPlasticReview(true)}
                      className={`flex-1 border p-3 rounded-[16px] flex flex-col items-center gap-1 transition-colors ${hasPlasticReview === true ? 'bg-[#10B981] border-[#10B981] text-white shadow-lg shadow-[#10B981]/30' : (isDark ? 'bg-[#162A45] border-white/10 text-white hover:bg-white/5' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50')}`}
                    >
                      <span className="font-extrabold text-[13px]">Oo, May Plastic</span>
                    </button>
                    <button
                      onClick={() => setHasPlasticReview(false)}
                      className={`flex-1 border p-3 rounded-[16px] flex flex-col items-center gap-1 transition-colors ${hasPlasticReview === false ? 'bg-[#E63946] border-[#E63946] text-white shadow-lg shadow-[#E63946]/30' : (isDark ? 'bg-[#162A45] border-white/10 text-white hover:bg-white/5' : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50')}`}
                    >
                      <span className="font-extrabold text-[13px]">Wala, Paper lang</span>
                    </button>
                  </div>
                </div>

                {/* Step 3: Optional Experience Flags */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-widest mb-3 block flex items-center gap-1.5 ${isDark ? 'text-blue-200/50' : 'text-gray-500'}`}><AlertTriangle size={12} /> Experience (Optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {['May fixer na nakita', 'Napakabilis', 'Masungit ang staff', 'Sira ang system'].map(flag => {
                      const isSelected = selectedFlags.includes(flag);
                      return (
                        <button
                          key={flag}
                          onClick={() => {
                            if (isSelected) setSelectedFlags(selectedFlags.filter(f => f !== flag));
                            else setSelectedFlags([...selectedFlags, flag]);
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-[#F59E0B] text-white border-[#F59E0B] shadow-lg shadow-[#F59E0B]/20' : (isDark ? 'bg-[#0A1626] text-blue-200/60 border-white/10' : 'bg-gray-100 text-gray-600 border-gray-200')}`}
                        >
                          {flag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleFinalSubmit}
                disabled={hasPlasticReview === null || isSubmitting}
                className={`w-full py-4 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 mt-2 transition-all flex-shrink-0 ${hasPlasticReview === null ? (isDark ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed') : 'bg-[#E63946] hover:bg-[#b32b37] text-white shadow-[0_4px_20px_rgba(230,57,70,0.4)] active:scale-[0.98]'}`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>I-sumite ang Ulat</>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
