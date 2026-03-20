import React from 'react';
import { Branch } from '../data/branches';
import { useNavigate } from 'react-router';
import { useTheme } from '../ThemeContext';

type Props = {
  open: boolean;
  branch: Branch | null;
  onClose: () => void;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const gradeTone = (grade: Branch['grade']) => {
  // FIX 5: Color-map grade badge for at-a-glance status.
  if (grade === 'A') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25';
  if (grade === 'B') return 'bg-tertiary/15 text-tertiary border-tertiary/25';
  if (grade === 'C') return 'bg-amber-500/15 text-amber-600 border-amber-500/25';
  if (grade === 'D') return 'bg-orange-500/15 text-orange-600 border-orange-500/25';
  if (grade === 'E') return 'bg-red-500/15 text-red-500 border-red-500/25';
  return 'bg-red-600/15 text-red-600 border-red-600/25';
};

const waitTone = (mins: number) => {
  // FIX 5: Color-map wait time values for consistency across cards and modal.
  if (mins < 120) return 'text-tertiary';
  if (mins <= 210) return 'text-amber-600';
  return 'text-error';
};

const formatMins = (mins: number) => {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
};

export function BranchDetailsSheet({ open, branch, onClose }: Props) {
  const navigate = useNavigate();
  const { isDemoMode } = useTheme();
  const [expandedReq, setExpandedReq] = React.useState<string | null>(null);
  const [reportToast, setReportToast] = React.useState<{ tag: string; type: 'success' | 'error' } | null>(null);
  const [bottleneck, setBottleneck] = React.useState<null | {
    transitions: Array<{
      transition: string;
      today_minutes_avg: number | null;
      week_minutes_avg: number | null;
      rolling_4week_minutes_avg: number | null;
    }>;
  }>(null);

  React.useEffect(() => {
    // FIX 5: Prevent background scroll while the bottom sheet is open.
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);


  // Persona 2A: "Ligtas Ka Ba?" pre-entry checklist in the branch details sheet.
  const [ligtasState, setLigtasState] = React.useState<{
    hasValidId: boolean | null;
    docsComplete: boolean | null;
    feesOnly: boolean | null;
  }>({
    hasValidId: null,
    docsComplete: null,
    feesOnly: null,
  });

  const allLigtasAnswered = ligitasStateAllAnswered(ligtasState);
  const allLigtasYes =
    ligitasStateAllAnswered(ligtasState) &&
    ligitasStateAllYes(ligtasState);

  function ligitasStateAllAnswered(state: typeof ligtasState) {
    return state.hasValidId !== null && state.docsComplete !== null && state.feesOnly !== null;
  }

  function ligitasStateAllYes(state: typeof ligtasState) {
    return state.hasValidId === true && state.docsComplete === true && state.feesOnly === true;
  }

  const firstNoKey = !allLigtasYes
    ? (ligtasState.hasValidId === false
        ? 'hasValidId'
        : ligtasState.docsComplete === false
          ? 'docsComplete'
          : ligtasState.feesOnly === false
            ? 'feesOnly'
            : null)
    : null;

  const ligitasNoInstruction: Record<string, string> = {
    hasValidId: 'Kunin muna ang iyong valid ID bago pumila.',
    docsComplete: 'Kumpletohin muna ang mga dokumento base sa listahan.',
    feesOnly: 'Tiyakin na official fees lang ang dala mo (walang dagdag).',
  };

  const ligitasBannerText = allLigtasYes
    ? 'Handa ka na. Huwag makinig sa mga taong mag-aalok ng serbisyo sa labas ng LTO.'
    : firstNoKey
      ? ligitasNoInstruction[firstNoKey]
      : '';

  // Persona 3B: Predictive morning estimate (Bukas ng umaga) row.
  const tomorrowDow = new Date(Date.now() + 24 * 60 * 60 * 1000).getDay();
  const morningSamples = branch?.historical_estimates?.walkin_morning_wait_minutes_by_dow?.[tomorrowDow];
  const morningMedianMins =
    morningSamples && morningSamples.length >= 5
      ? (() => {
          const sorted = [...morningSamples].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          return Math.round(median);
        })()
      : null;

  const morningEstimateText =
    morningMedianMins !== null
      ? (() => {
          const h = Math.floor(morningMedianMins / 60);
          const m = morningMedianMins % 60;
          return `Bukas, ~${h}h ${m}m ang pila (Walk-in)`;
        })()
      : null;

  if (!branch) return null;

  const isPuno = branch.is_puno === true;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${branch.lat},${branch.lng}`)}`; // FIX 5: Open Google Maps with branch coordinates.

  const walk = branch.walkinAvgMinutes;
  const appt = branch.appointmentAvgMinutes;

  const last5 = [...branch.recentReports].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5); // FIX 5: Show last 5 timer submissions.

  return (
    <div className={`fixed inset-0 z-[90] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-label="Isara ang detalye"
      />

      <div
        className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl bg-surface-container-lowest dark:bg-slate-900 rounded-t-[24px] border-t border-outline-variant/10 dark:border-slate-700/30 shadow-2xl transition-transform duration-[350ms] ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-3 pb-2 relative">
          <div className="w-full flex justify-center">
            <div className="w-12 h-1.5 bg-slate-400/30 dark:bg-slate-600 rounded-full" /> {/* FIX 5: Standard centered drag handle pill. */}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-4 z-10 p-2 rounded-full bg-surface-container-low dark:bg-slate-700/50 text-on-surface dark:text-slate-100 transition-colors"
            aria-label="Isara"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="px-6 pb-8 overflow-y-auto max-h-[85vh]">
          {/* Section 1 — Branch Header */}
          <div className="pt-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-on-surface dark:text-slate-100 tracking-tight">{branch.name}</h2>
                <div className="mt-2 text-sm text-on-surface-variant dark:text-slate-400 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-base mt-0.5">location_on</span>
                  <span className="leading-snug">{branch.address}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-container-low dark:bg-slate-700/50 text-on-surface-variant dark:text-slate-400 border border-outline-variant/10 dark:border-slate-700/30">
                    {branch.distanceKm.toFixed(1)} km {/* FIX 5: Distance badge. */}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-container-low dark:bg-slate-700/50 text-on-surface-variant dark:text-slate-400 border border-outline-variant/10 dark:border-slate-700/30">
                    {branch.operatingHours} {/* FIX 5: Operating hours. */}
                  </span>
                </div>
              </div>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 flex-none bg-transparent border border-outline-variant/50 text-primary dark:border-primary/50 dark:text-primary rounded-[20px] px-4 py-[6px] text-[12px] font-bold transition-colors whitespace-nowrap"
                style={{
                  border: '1px solid var(--color-border-primary, #B7102A)',
                  color: 'var(--color-text-primary, #B7102A)',
                }}
              >
                Directions
              </a>
            </div>
          </div>

          {/* Persona 2A: Ligtas Ka Ba? pre-entry checklist (collapses after answering all 3) */}
          <div className="mt-6">
            {!allLigtasAnswered ? (
              <div className="space-y-3">
                <div className="font-extrabold text-[14px] text-on-surface dark:text-slate-100">Ligtas Ka Ba?</div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-3 py-3 border-b border-outline-variant/10 dark:border-slate-700/30">
                    <div className="text-[14px] font-normal flex-1 pr-2 text-on-surface-variant dark:text-slate-300">
                      May dalang valid ID ka ba?
                    </div>
                    <div className="flex gap-2 w-[180px]">
                      <button
                        type="button"
                        onClick={() => setLigtasState((p) => ({ ...p, hasValidId: true }))}
                        className={`flex-1 rounded-[20px] px-5 py-2 text-[13px] font-medium transition-colors border ${
                          ligtasState.hasValidId === true
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-500' // green tint
                            : 'bg-surface-secondary text-secondary border-tertiary'
                        }`}
                        style={{
                          background: ligtasState.hasValidId === true ? 'var(--color-background-success, #ecfdf5)' : 'var(--color-background-secondary, #f8fafc)',
                          color: ligtasState.hasValidId === true ? 'var(--color-text-success, #047857)' : 'var(--color-text-secondary, #64748b)',
                          border: ligtasState.hasValidId === true ? '1px solid var(--color-text-success, #047857)' : '0.5px solid var(--color-border-tertiary, #e2e8f0)',
                        }}
                      >
                        Oo
                      </button>
                      <button
                        type="button"
                        onClick={() => setLigtasState((p) => ({ ...p, hasValidId: false }))}
                        className={`flex-1 rounded-[20px] px-5 py-2 text-[13px] font-medium transition-colors border ${
                          ligtasState.hasValidId === false
                            ? 'bg-red-50 text-red-700 border-red-500' // red tint
                            : 'bg-surface-secondary text-secondary border-tertiary'
                        }`}
                        style={{
                          background: ligtasState.hasValidId === false ? 'var(--color-background-danger, #fef2f2)' : 'var(--color-background-secondary, #f8fafc)',
                          color: ligtasState.hasValidId === false ? 'var(--color-text-danger, #b91c1c)' : 'var(--color-text-secondary, #64748b)',
                          border: ligtasState.hasValidId === false ? '1px solid var(--color-text-danger, #b91c1c)' : '0.5px solid var(--color-border-tertiary, #e2e8f0)',
                        }}
                      >
                        Hindi
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 py-3 border-b border-outline-variant/10 dark:border-slate-700/30">
                    <div className="text-[14px] font-normal flex-1 pr-2 text-on-surface-variant dark:text-slate-300">
                      Kumpleto ba ang iyong mga dokumento ayon sa listahan sa ibaba?
                    </div>
                    <div className="flex gap-2 w-[180px]">
                      <button
                        type="button"
                        onClick={() => setLigtasState((p) => ({ ...p, docsComplete: true }))}
                        className={`flex-1 rounded-[20px] px-5 py-2 text-[13px] font-medium transition-colors border ${
                          ligtasState.docsComplete === true
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-500'
                            : 'bg-surface-secondary text-secondary border-tertiary'
                        }`}
                        style={{
                          background: ligtasState.docsComplete === true ? 'var(--color-background-success, #ecfdf5)' : 'var(--color-background-secondary, #f8fafc)',
                          color: ligtasState.docsComplete === true ? 'var(--color-text-success, #047857)' : 'var(--color-text-secondary, #64748b)',
                          border: ligtasState.docsComplete === true ? '1px solid var(--color-text-success, #047857)' : '0.5px solid var(--color-border-tertiary, #e2e8f0)',
                        }}
                      >
                        Oo
                      </button>
                      <button
                        type="button"
                        onClick={() => setLigtasState((p) => ({ ...p, docsComplete: false }))}
                        className={`flex-1 rounded-[20px] px-5 py-2 text-[13px] font-medium transition-colors border ${
                          ligtasState.docsComplete === false
                            ? 'bg-red-50 text-red-700 border-red-500'
                            : 'bg-surface-secondary text-secondary border-tertiary'
                        }`}
                        style={{
                          background: ligtasState.docsComplete === false ? 'var(--color-background-danger, #fef2f2)' : 'var(--color-background-secondary, #f8fafc)',
                          color: ligtasState.docsComplete === false ? 'var(--color-text-danger, #b91c1c)' : 'var(--color-text-secondary, #64748b)',
                          border: ligtasState.docsComplete === false ? '1px solid var(--color-text-danger, #b91c1c)' : '0.5px solid var(--color-border-tertiary, #e2e8f0)',
                        }}
                      >
                        Hindi
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="text-[14px] font-normal flex-1 pr-2 text-on-surface-variant dark:text-slate-300">
                      Handa ka na sa bayad ng official fees lang (walang dagdag)?
                    </div>
                    <div className="flex gap-2 w-[180px]">
                      <button
                        type="button"
                        onClick={() => setLigtasState((p) => ({ ...p, feesOnly: true }))}
                        className={`flex-1 rounded-[20px] px-5 py-2 text-[13px] font-medium transition-colors border ${
                          ligtasState.feesOnly === true
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-500'
                            : 'bg-surface-secondary text-secondary border-tertiary'
                        }`}
                        style={{
                          background: ligtasState.feesOnly === true ? 'var(--color-background-success, #ecfdf5)' : 'var(--color-background-secondary, #f8fafc)',
                          color: ligtasState.feesOnly === true ? 'var(--color-text-success, #047857)' : 'var(--color-text-secondary, #64748b)',
                          border: ligtasState.feesOnly === true ? '1px solid var(--color-text-success, #047857)' : '0.5px solid var(--color-border-tertiary, #e2e8f0)',
                        }}
                      >
                        Oo
                      </button>
                      <button
                        type="button"
                        onClick={() => setLigtasState((p) => ({ ...p, feesOnly: false }))}
                        className={`flex-1 rounded-[20px] px-5 py-2 text-[13px] font-medium transition-colors border ${
                          ligtasState.feesOnly === false
                            ? 'bg-red-50 text-red-700 border-red-500'
                            : 'bg-surface-secondary text-secondary border-tertiary'
                        }`}
                        style={{
                          background: ligtasState.feesOnly === false ? 'var(--color-background-danger, #fef2f2)' : 'var(--color-background-secondary, #f8fafc)',
                          color: ligtasState.feesOnly === false ? 'var(--color-text-danger, #b91c1c)' : 'var(--color-text-secondary, #64748b)',
                          border: ligtasState.feesOnly === false ? '1px solid var(--color-text-danger, #b91c1c)' : '0.5px solid var(--color-border-tertiary, #e2e8f0)',
                        }}
                      >
                        Hindi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`border rounded-2xl p-4 ${
                  allLigtasYes
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-base mt-0.5" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                    {allLigtasYes ? 'check_circle' : 'warning'}
                  </span>
                  <div className="font-extrabold text-[14px] leading-snug">{ligitasBannerText}</div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2 — Live Status Row */}
          <div className="mt-6 flex gap-2">
            <div
              className={`flex-1 px-3 py-2 rounded-full text-xs font-extrabold border text-center ${
                branch.hasPlasticCards ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25' : 'bg-red-500/15 text-red-600 border-red-500/25'
              }`}
            >
              {branch.hasPlasticCards ? 'May Plastic' : 'Wala Plastic'} {/* FIX 5: Plastic availability pill. */}
            </div>
            <div className={`flex-1 px-3 py-2 rounded-full text-xs font-extrabold border text-center ${gradeTone(branch.grade)}`}>
              Grade {branch.grade} {/* FIX 5: Grade badge A–F. */}
            </div>
            <div className="flex-1 px-3 py-2 rounded-full text-xs font-extrabold border text-center bg-surface-container-low dark:bg-slate-700/50 text-on-surface-variant dark:text-slate-400 border-outline-variant/10 dark:border-slate-700/30">
              {branch.reportsToday} ulat ngayon {/* FIX 5: Live report count for today. */}
            </div>
          </div>

          {/* Persona 3B: Bukas ng umaga predictive estimate row */}
          {morningEstimateText && (
            <div className="mt-4 flex items-center gap-2 text-[12px] text-on-surface-variant dark:text-slate-400">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                schedule
              </span>
              {(() => {
                const parts = morningEstimateText.split('Walk-in');
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
          )}

          {/* Section 3 — Heads Up Card (community requirements accordion) */}
          <div className="mt-6 border rounded-2xl p-4 bg-amber-500/5 dark:bg-amber-950/60 border-amber-500/30 dark:border-amber-700">
            <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 mb-3">
              Mga hiningi sa ibang tao ngayon sa branch na ito
            </div>
            {branch.communityRequirements7d.length ? (
              <div className="space-y-2">
                {[...branch.communityRequirements7d]
                  .sort((a, b) => (a.status === 'missing' ? -1 : 1) - (b.status === 'missing' ? -1 : 1))
                  .map((r) => {
                    const isOk = r.status === 'ok';
                    const isExpanded = expandedReq === r.tag;
                    return (
                      <div key={r.tag}>
                        <button
                          type="button"
                          onClick={() => setExpandedReq(isExpanded ? null : r.tag)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant/10 dark:border-slate-700/30 text-left transition-colors hover:bg-surface-container-low dark:hover:bg-slate-700"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`material-symbols-outlined text-[28px] flex-shrink-0 ${
                                isOk ? 'text-emerald-500 dark:text-emerald-400' : 'text-error dark:text-red-400'
                              }`}
                              style={{ fontVariationSettings: "'FILL' 1" } as any}
                            >
                              {isOk ? 'check_box' : 'check_box_outline_blank'}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-on-surface dark:text-slate-100" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', lineHeight: '1.4' }}>{r.labelFil}</div>
                              <div className={`text-[11px] font-extrabold ${isOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-error dark:text-red-400'} whitespace-nowrap`}>
                                {isOk ? 'OK naman daw ngayon' : 'HINIHINGI NGAYON'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div
                              className={`px-3 py-1 rounded-full text-[11px] font-extrabold border whitespace-nowrap ${
                                isOk
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-500/20 dark:border-emerald-800/30'
                                  : 'bg-red-500/10 text-error dark:bg-red-950/60 dark:text-red-300 border-red-500/20 dark:border-red-800/30'
                              }`}
                            >
                              {r.count} nag-ulat
                            </div>
                            <span className={`material-symbols-outlined text-base text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                          </div>
                        </button>

                        {/* Accordion expanded detail */}
                        {isExpanded && (
                          <div className="mt-1 px-3 py-3 rounded-xl bg-surface-container-low dark:bg-slate-700/50 border border-outline-variant/10 dark:border-slate-700/30">
                            <div className="font-bold text-[14px] text-on-surface dark:text-slate-100 mb-1" style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{r.labelFil}</div>
                            <div className={`text-[12px] font-extrabold mb-2 ${isOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-error dark:text-red-400'}`}>
                              {isOk ? 'OK NAMAN DAW NGAYON' : 'HINIHINGI NGAYON'}
                            </div>
                            <div className="text-[12px] text-on-surface-variant dark:text-slate-400 leading-relaxed mb-3">
                              {r.count} tao ang nag-ulat nito ngayon.
                              {!isOk && ' Ibig sabihin: huwag pumunta nang walang requirement na ito.'}
                            </div>

                            {reportToast?.tag === r.tag ? (
                              <div className={`text-[12px] font-bold px-3 py-2 rounded-lg ${reportToast.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-error'}`}>
                                {reportToast.type === 'success' ? 'Na-record ang iyong report. Salamat!' : 'Hindi na-record. Subukan ulit.'}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    if (isDemoMode) {
                                      await new Promise(res => setTimeout(res, 500));
                                    } else {
                                      const res = await fetch(`/api/branches/${branch.id}/requirements`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ tag: r.tag }),
                                      });
                                      if (!res.ok) throw new Error('fail');
                                    }
                                    setReportToast({ tag: r.tag, type: 'success' });
                                  } catch {
                                    setReportToast({ tag: r.tag, type: 'error' });
                                  }
                                  setTimeout(() => setReportToast(null), 3000);
                                }}
                                className="text-[12px] font-bold text-primary hover:underline underline-offset-2"
                              >
                                I-report din ito ▾
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400">Walang hiningi ngayon.</div>
            )}
          </div>

          {/* Section 4 — Wait Time Breakdown */}
          <div className="mt-6 bg-surface-container-low dark:bg-slate-800 rounded-2xl p-4 border border-outline-variant/10 dark:border-slate-700/30">
            <div className="font-extrabold text-[13px] text-on-surface dark:text-slate-100 mb-3">Wait Time Breakdown</div>
            <div className="flex items-center justify-between py-2">
              <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
                <span>Walk-in</span>
                <span>average</span>
              </div>
              <div className={`text-sm font-black flex items-center gap-1 ${waitTone(walk)}`}>
                {formatMins(walk)}
                <span className="material-symbols-outlined text-base">trending_up</span> {/* FIX 5: Trending arrow icon. */}
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-outline-variant/10 dark:border-slate-700/30">
              <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
                <span>Appointment</span>
                <span>average</span>
              </div>
              <div className={`text-sm font-black flex items-center gap-1 ${waitTone(appt)}`}>
                {formatMins(appt)}
                <span className="material-symbols-outlined text-base">trending_down</span> {/* FIX 5: Trending arrow icon. */}
              </div>
            </div>

            {/* SECURITY: Gap 8 integrity uncertainty note (muted amber) below wait-time display. */}
            {branch.data_integrity_warning && (
              <div className="mt-3 text-[12px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                Ang datos ngayon ay may malaking pagkakaiba — maaaring may hindi tumpak na report.
              </div>
            )}
          </div>

          {/* Section 5 — Pre-Queue Info */}
          {branch.prequeueMinutesBeforeOpen !== undefined && (
            <div className="mt-6 border rounded-2xl p-4 bg-amber-500/10 dark:bg-amber-950/50 border-amber-500/30">
              <div className="font-extrabold text-[13px] text-amber-700 dark:text-amber-400 mb-1">Pre-Queue Info</div>
              <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Karaniwan, {branch.prequeueMinutesBeforeOpen} minuto ang pila bago pa man mag-bukas. {/* FIX 5: Conditional pre-queue card. */}
              </div>
            </div>
          )}



          {/* Section 6 — Recent Reports Log */}
          <div className="mt-6">
            <div className="font-extrabold text-[13px] text-on-surface dark:text-slate-100 mb-3">Recent Reports</div>
            <div className="space-y-2">
              {last5.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl p-3 border bg-surface-container-lowest dark:bg-slate-700/50 border-outline-variant/10 dark:border-slate-700/30 flex items-center justify-between gap-3 ${
                    r.isAnomaly ? 'ring-1 ring-error/30' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-on-surface dark:text-slate-100 truncate">
                      {r.queuePrefix} • {r.transactionType}
                    </div>
                    <div className="text-[11px] font-semibold text-on-surface-variant dark:text-slate-400">
                      {formatMins(r.waitMinutes)} wait
                    </div>
                  </div>
                  {r.isAnomaly && (
                    <div className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-error/15 text-error border border-error/25">
                      <span className="inline-flex items-center gap-2">
                        ANOMALY {/* FIX 5: Anomaly flag indicator. */}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Flow 2: explicit "Pumila Dito" action inside the modal */}
          <div className="mt-6 pb-3">
            <button
              type="button"
              disabled={isPuno}
              onClick={() => {
                if (isPuno) return;
                navigate(`/queue?branch=${encodeURIComponent(branch.id)}`);
                onClose();
              }}
              className={`w-full py-3 rounded-full font-extrabold text-sm transition-transform active:scale-[0.99] ${
                isPuno
                  ? 'bg-[#6B1F1F] text-white opacity-90 cursor-not-allowed'
                  : 'bg-primary text-white dark:bg-white dark:text-black shadow-md shadow-primary/20'
              }`}
            >
              {isPuno ? 'PUNO NA — Bumalik Bukas' : 'Pumila Dito'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

