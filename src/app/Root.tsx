import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useTheme } from './ThemeContext';
import { DEMO_MODE } from '../config.js';
import { vibrateSafe } from './utils/haptics';

export function Root() {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [city, setCity] = React.useState('Quezon City, NCR'); // FIX 2: Store detected city in Root state for the global header pill.
  const [isLocationModalOpen, setLocationModalOpen] = React.useState(false); // FIX 2: Make location picker accessible from header on all screens.
  const [langMode, setLangMode] = React.useState<'eng' | 'fil'>(() => {
    try {
      return localStorage.getItem('ligtaslto_lang') === 'fil' ? 'fil' : 'eng';
    } catch {
      return 'eng';
    }
  });

  const [isOnboardingOpen, setOnboardingOpen] = React.useState(false);
  const [isOnboarded, setIsOnboarded] = React.useState(true);

  type NotificationType = 'anomaly' | 'warning' | 'update';
  type NotificationItem = { id: string; type: NotificationType; title: string; description: string; createdAt: number };
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([
    // FIX 1: Local notifications state (reverse-chronological rendering in drawer).
    { id: 'n1', type: 'warning', title: 'Mataas ang pila sa Novaliches', description: 'Lagpas 4 na oras ang walk-in average ngayon.', createdAt: Date.now() - 5 * 60 * 1000 },
    { id: 'n2', type: 'update', title: 'May bagong ulat sa Diliman', description: 'Na-update ang plastic card availability.', createdAt: Date.now() - 35 * 60 * 1000 },
  ]);
  const [isNotifOpen, setNotifOpen] = React.useState(false); // FIX 1: Slide-in notification drawer open state.
  const [lastNotifSeenAt, setLastNotifSeenAt] = React.useState(0); // FIX 1: Badge visibility depends on whether new notifs arrived since last open.
  const latestNotifAt = notifications.length ? Math.max(...notifications.map((n) => n.createdAt)) : 0;
  const hasUnreadNotifs = latestNotifAt > lastNotifSeenAt; // FIX 1: Badge reappears only when a new notification is added.

  const formatRelativeFil = (ts: number) => {
    // FIX 1: Render relative time in Filipino (e.g. "5 minuto na ang nakalipas").
    const diffMs = Date.now() - ts;
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    if (mins < 1) return 'Ngayon lang';
    if (mins < 60) return `${mins} minuto na ang nakalipas`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} oras na ang nakalipas`;
    const days = Math.floor(hrs / 24);
    return `${days} araw na ang nakalipas`;
  };

  React.useEffect(() => {
    // FIX 5: Lock background scrolling when overlays are open.
    const shouldLock = isNotifOpen || isLocationModalOpen || isOnboardingOpen;
    if (!shouldLock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isNotifOpen, isLocationModalOpen, isOnboardingOpen]);

  React.useEffect(() => {
    // FIX 1/2: Allow any screen (e.g. Home hero buttons) to open the global drawer/modals without prop drilling.
    const openNotifs = () => {
      setNotifOpen(true);
      setLastNotifSeenAt(Date.now());
    };
    const openLocation = () => setLocationModalOpen(true);
    window.addEventListener('ligtaslto:open-notifs', openNotifs as any);
    window.addEventListener('ligtaslto:open-location', openLocation as any);
    return () => {
      window.removeEventListener('ligtaslto:open-notifs', openNotifs as any);
      window.removeEventListener('ligtaslto:open-location', openLocation as any);
    };
  }, []);

  React.useEffect(() => {
    // FIX 4A: Show onboarding overlay on first open.
    try {
      const onb = window.ligtasltoOnboarding;
      const onboarded = Boolean(onb?.isOnboarded?.());
      setIsOnboarded(onboarded);
      setOnboardingOpen(!onboarded);
    } catch {
      setIsOnboarded(true);
      setOnboardingOpen(false);
    }

    const onComplete = () => {
      setIsOnboarded(true);
      setOnboardingOpen(false);
      navigate('/');
    };
    window.addEventListener('ligtaslto:onboarding-complete', onComplete as any);
    return () => window.removeEventListener('ligtaslto:onboarding-complete', onComplete as any);
  }, [navigate]);

  const navItems = [
    { path: '/', icon: 'home', label: 'Tahanan' },
    { path: '/branches', icon: 'map', label: 'Sanga' },
    { path: '/queue', icon: 'layers', label: 'Pila' },
    { path: '/pre-check', icon: 'fact_check', label: 'Pre-Check' },
  ];

  const headerTopClass = DEMO_MODE ? 'top-7' : 'top-0';

  return (
    <div className={`min-h-screen bg-surface dark:bg-slate-900 text-on-surface dark:text-slate-100 selection:bg-primary-fixed pb-32`}>
      {/* FIX 4: Dark mode is applied via <html class="dark"> (see ThemeContext + main.tsx bootstrap). */}
      {DEMO_MODE && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-400 text-amber-900 text-[11px] font-bold text-center py-1.5 px-4 w-full">
          DEMO MODE — Location checks disabled
        </div>
      )}

      <header className={`fixed ${headerTopClass} w-full z-50 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-lg shadow-sm dark:shadow-none`}>
        <div className="flex items-center justify-between px-6 py-4 w-full">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5 p-2 bg-on-surface rounded-lg">
              <div className="w-3 h-3 rounded-full bg-error"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-extrabold text-red-600 dark:text-red-500 tracking-tighter font-['Plus_Jakarta_Sans'] leading-none">
                LigtasLTO
              </h1>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="text-[11px] font-semibold text-on-surface-variant dark:text-slate-400 flex items-center gap-1 mt-1"
                aria-label="Buksan ang location picker"
              >
                {/* FIX 2: Location pill replaces the redundant building icon and opens the existing picker. */}
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span className="truncate max-w-[200px]">{city}</span>
              </button>

              {isOnboarded && (
                <button
                  type="button"
                  onClick={() => setOnboardingOpen(true)}
                  className="text-[11px] font-bold text-primary underline underline-offset-2 mt-2"
                >
                  Palitan
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen(true); // FIX 1: Bell now opens the slide-in notification drawer.
                setLastNotifSeenAt(Date.now()); // FIX 1: Opening the drawer clears the unread badge.
              }}
              className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 duration-200 text-slate-500"
            >
              <span className="material-symbols-outlined">notifications</span>
              {hasUnreadNotifs && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error" />} {/* FIX 1: Unread dot hides after open and returns only on new notif. */}
            </button>

            {/* FIX 5A: Language toggle (FIL/ENG) */}
            <button
              type="button"
              onClick={() => {
                const next = langMode === 'fil' ? 'eng' : 'fil';
                setLangMode(next);
                try {
                  window.ligtasltoStringsFil?.setLangMode?.(next);
                } catch {}
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors active:scale-95 ${
                langMode === 'fil'
                  ? 'bg-blue-900 text-blue-300 border-blue-500/50'
                  : 'bg-surface-container-lowest dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-outline-variant/10'
              }`}
              aria-label="Language mode"
            >
              {langMode === 'fil' ? 'FIL' : 'ENG'}
            </button>

            <button
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 duration-200 text-slate-500"
            >
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </div>
        <div className="bg-slate-200/50 dark:bg-slate-800/50 h-[1px]"></div>
      </header>

      {/* FIX 1: Right-side notification drawer with translateX transition and tappable backdrop. */}
      <div className={`fixed inset-0 z-[70] ${isNotifOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isNotifOpen}>
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out ${isNotifOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setNotifOpen(false)} // FIX 1: Backdrop tap closes the drawer.
          aria-label="Isara ang notifications"
        />
        <aside
          className={`absolute top-0 right-0 h-full w-[86%] max-w-sm bg-surface-container-lowest dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-out ${
            isNotifOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10 dark:border-slate-700/30">
            <div className="font-extrabold tracking-tight text-lg text-on-surface dark:text-slate-100">Mga Abiso</div>
            <button
              type="button"
              onClick={() => setNotifOpen(false)}
              className="p-2 rounded-full bg-surface-container-low dark:bg-slate-700/50 text-on-surface dark:text-slate-100"
              aria-label="Isara"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <div className="p-5 space-y-3 overflow-y-auto h-[calc(100%-64px)]">
            {[...notifications]
              .sort((a, b) => b.createdAt - a.createdAt) // FIX 1: Reverse-chronological order.
              .map((n) => {
                const border =
                  n.type === 'anomaly' ? 'border-l-error' : n.type === 'warning' ? 'border-l-amber-500' : 'border-l-tertiary';
                return (
                  <div
                    key={n.id}
                    className={`border-l-4 ${border} bg-surface-container-low dark:bg-slate-700/50 rounded-xl p-4 border border-outline-variant/10 dark:border-slate-700/30`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-on-surface dark:text-slate-100 truncate">{n.title}</div>
                        <div className="text-xs text-on-surface-variant dark:text-slate-400 line-clamp-1 mt-1">{n.description}</div>
                        <div className="text-[10px] font-bold text-on-surface-variant dark:text-slate-400 mt-2">
                          {formatRelativeFil(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

            {notifications.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                {/* FIX 1: Empty state when there are no notifications. */}
                <span className="material-symbols-outlined text-6xl text-on-surface-variant dark:text-slate-400 mb-3">notifications_off</span>
                <div className="font-bold text-on-surface dark:text-slate-100">Walang bagong abiso.</div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* FIX 2: Global location picker modal (reusing existing list UI, now reachable from header). */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setLocationModalOpen(false)}
            aria-label="Isara ang location picker"
          />
          <div className="relative w-full max-w-sm rounded-lg p-6 shadow-2xl border bg-surface-container-lowest dark:bg-slate-900 border-outline-variant/10 dark:border-slate-700/30">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold tracking-tight text-lg text-on-surface dark:text-slate-100">Pumili ng Lokasyon</h3>
              <button onClick={() => setLocationModalOpen(false)} className="p-2 rounded-full bg-surface-container-low dark:bg-slate-700/50 text-on-surface dark:text-slate-100">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {['Quezon City, NCR', 'Manila City, NCR', 'Makati City, NCR'].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCity(c); // FIX 2: Location pill reflects selected city.
                    setLocationModalOpen(false);
                  }}
                  className={`text-left px-4 py-3 rounded-xl font-bold text-sm transition-colors hover:bg-surface-container-low dark:hover:bg-slate-700/50 ${
                    c === city ? 'bg-primary/10 text-primary' : 'text-on-surface dark:text-slate-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className={`px-6 max-w-2xl mx-auto ${DEMO_MODE ? 'pt-32' : 'pt-24'}`}>
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-8 pt-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl shadow-[0_-8px_32px_rgba(25,28,30,0.04)] rounded-t-[2.5rem]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const iconFill = isActive ? "font-variation-settings: 'FILL' 1;" : undefined;

          return (
            <button
              key={item.path}
              onClick={() => {
                vibrateSafe(50); // IMPROVEMENT 5: Haptic feedback on tab navigation (50ms).
                navigate(item.path);
              }}
              className={
                isActive
                  ? "flex flex-col items-center justify-center bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full px-5 py-2 transition-transform active:scale-90"
                  : "flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-5 py-2 hover:text-red-500 dark:hover:text-red-300 transition-transform active:scale-90"
              }
            >
              <span className="material-symbols-outlined" style={iconFill ? ({ fontVariationSettings: "'FILL' 1" } as any) : undefined}>
                {item.icon}
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-[11px] font-semibold tracking-wide uppercase mt-1">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* FIX 4A: Baguhan Ka Ba? onboarding overlay (transaction-first) */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 min-h-screen flex items-center justify-center px-6">
          <div className="w-full">
            <div className="text-center">
              <div className="text-[22px] font-bold text-on-surface dark:text-slate-100 mb-6">
                Ano ang gagawin mo sa LTO ngayon?
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="h-[140px] rounded-[20px] border border-outline-variant/10 dark:border-slate-700 bg-surface-container-lowest dark:bg-slate-800 flex flex-col items-center justify-center gap-3 cursor-pointer"
                onClick={() => window.ligtasltoOnboarding?.setOnboardingSelection?.('Student Permit')}
              >
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant dark:text-slate-200" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                  menu_book
                </span>
                <div className="text-[14px] font-bold text-on-surface dark:text-slate-100">Student Permit</div>
              </button>

              <button
                type="button"
                className="h-[140px] rounded-[20px] border border-outline-variant/10 dark:border-slate-700 bg-surface-container-lowest dark:bg-slate-800 flex flex-col items-center justify-center gap-3 cursor-pointer"
                onClick={() => window.ligtasltoOnboarding?.setOnboardingSelection?.('License Renewal')}
              >
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant dark:text-slate-200" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                  credit_card
                </span>
                <div className="text-[14px] font-bold text-on-surface dark:text-slate-100">License Renewal</div>
              </button>

              <button
                type="button"
                className="h-[140px] rounded-[20px] border border-outline-variant/10 dark:border-slate-700 bg-surface-container-lowest dark:bg-slate-800 flex flex-col items-center justify-center gap-3 cursor-pointer"
                onClick={() => window.ligtasltoOnboarding?.setOnboardingSelection?.('Vehicle Registration')}
              >
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant dark:text-slate-200" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                  directions_car
                </span>
                <div className="text-[14px] font-bold text-on-surface dark:text-slate-100">Vehicle Registration</div>
              </button>

              <button
                type="button"
                className="h-[140px] rounded-[20px] border border-outline-variant/10 dark:border-slate-700 bg-surface-container-lowest dark:bg-slate-800 flex flex-col items-center justify-center gap-3 cursor-pointer"
                onClick={() => window.ligtasltoOnboarding?.setOnboardingSelection?.("Driver's License")}
              >
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant dark:text-slate-200" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                  badge
                </span>
                <div className="text-[14px] font-bold text-on-surface dark:text-slate-100">Driver&apos;s License</div>
              </button>

              <button
                type="button"
                className="col-span-2 h-[72px] rounded-[20px] border border-outline-variant/10 dark:border-slate-700 bg-surface-container-lowest dark:bg-slate-800 flex items-center justify-center gap-3 cursor-pointer"
                onClick={() => window.ligtasltoOnboarding?.setOnboardingSelection?.('Hindi ko alam')}
              >
                <span className="material-symbols-outlined text-[40px] text-on-surface-variant dark:text-slate-200" style={{ fontVariationSettings: "'FILL' 1" } as any}>
                  help_outline
                </span>
                <div className="text-[14px] font-bold text-on-surface dark:text-slate-100">Hindi ko alam</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}