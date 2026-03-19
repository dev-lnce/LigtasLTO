import React from 'react';
import { Branch } from '../data/branches';

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
  React.useEffect(() => {
    // FIX 5: Prevent background scroll while the bottom sheet is open.
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!branch) return null;

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
        <div className="flex items-center justify-between px-6 pt-3 pb-2">
          <div className="w-full flex justify-center">
            <div className="w-12 h-1.5 bg-slate-400/30 dark:bg-slate-600 rounded-full" /> {/* FIX 5: Standard centered drag handle pill. */}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-3 p-2 rounded-full bg-surface-container-low dark:bg-slate-700/50 text-on-surface dark:text-slate-100"
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
                className="shrink-0 px-4 py-2 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
              >
                Directions {/* FIX 5: Directions button opens Google Maps. */}
              </a>
            </div>
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

          {/* Section 3 — Heads Up Card */}
          <div className="mt-6 border rounded-2xl p-4 bg-amber-500/5 dark:bg-amber-950/60 border-amber-500/30 dark:border-amber-700">
            <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400 font-extrabold text-[13px]">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                warning
              </span>
              Heads Up (Community)
            </div>
            {branch.communityRequirements7d.length ? (
              <div className="space-y-2">
                {branch.communityRequirements7d.map((r) => (
                  <div key={r.tag} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant/10 dark:border-slate-700/30">
                    <div className="font-bold text-sm text-on-surface dark:text-slate-100 truncate">{r.tag}</div>
                    <div className="text-[11px] font-extrabold text-on-surface-variant dark:text-slate-400 whitespace-nowrap">
                      {clamp(r.count, 0, 999)} users ngayon {/* FIX 5: Show count per requirement report. */}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400">Walang espesyal na requirements ngayon.</div> // FIX 5: Empty message if no requirement reports.
            )}
          </div>

          {/* Section 4 — Wait Time Breakdown */}
          <div className="mt-6 bg-surface-container-low dark:bg-slate-800 rounded-2xl p-4 border border-outline-variant/10 dark:border-slate-700/30">
            <div className="font-extrabold text-[13px] text-on-surface dark:text-slate-100 mb-3">Wait Time Breakdown</div>
            <div className="flex items-center justify-between py-2">
              <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400">Walk-in average</div>
              <div className={`text-sm font-black flex items-center gap-1 ${waitTone(walk)}`}>
                {formatMins(walk)}
                <span className="material-symbols-outlined text-base">trending_up</span> {/* FIX 5: Trending arrow icon. */}
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-outline-variant/10 dark:border-slate-700/30">
              <div className="text-sm font-semibold text-on-surface-variant dark:text-slate-400">Appointment average</div>
              <div className={`text-sm font-black flex items-center gap-1 ${waitTone(appt)}`}>
                {formatMins(appt)}
                <span className="material-symbols-outlined text-base">trending_down</span> {/* FIX 5: Trending arrow icon. */}
              </div>
            </div>
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
                      ANOMALY {/* FIX 5: Anomaly flag indicator. */}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

