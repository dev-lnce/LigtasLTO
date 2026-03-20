import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  demoDistanceKm: number;
  setDemoDistanceKm: (dist: number) => void;
  demoAddedWaitMins: number;
  setDemoAddedWaitMins: (mins: number) => void;
  transactionType: string | null;
  setTransactionType: (type: string | null) => void;
  getAdjustedWaitTime: (baseMinutes: number) => number;
};

const STORAGE_KEY = 'ligtaslto_theme';
const DEMO_STORAGE_KEY = 'ligtaslto_demo_mode';
const TX_STORAGE_KEY = 'ligtaslto_transaction';

const applyHtmlDarkClass = (isDark: boolean) => {
  try {
    document.documentElement.classList.toggle('dark', isDark);
  } catch {}
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
  isDemoMode: false,
  toggleDemoMode: () => {},
  demoDistanceKm: 1.5,
  setDemoDistanceKm: () => {},
  demoAddedWaitMins: 0,
  setDemoAddedWaitMins: () => {},
  transactionType: null,
  setTransactionType: () => {},
  getAdjustedWaitTime: (m) => m,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoDistanceKm, setDemoDistanceKm] = useState(1.5);
  const [demoAddedWaitMins, setDemoAddedWaitMins] = useState(0);
  const [transactionType, setTransactionType] = useState<string | null>(null);

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    const next = stored === 'dark';
    setIsDark(next);
    applyHtmlDarkClass(next);

    const storedDemo = (() => {
      try {
        return localStorage.getItem(DEMO_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    setIsDemoMode(storedDemo === 'true');

    const storedTx = (() => {
      try {
        return localStorage.getItem(TX_STORAGE_KEY);
      } catch {
        return null;
      }
    })();
    setTransactionType(storedTx);
  }, []);

  useEffect(() => {
    applyHtmlDarkClass(isDark);
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, isDemoMode ? 'true' : 'false');
    } catch {}
  }, [isDemoMode]);

  useEffect(() => {
    if (transactionType) {
      try {
        localStorage.setItem(TX_STORAGE_KEY, transactionType);
      } catch {}
    } else {
      try {
        localStorage.removeItem(TX_STORAGE_KEY);
      } catch {}
    }
  }, [transactionType]);

  const toggleTheme = () => setIsDark((v) => !v);
  const toggleDemoMode = () => setIsDemoMode((v) => !v);

  // Distinct Data Path Logic modifier
  const getAdjustedWaitTime = (baseMinutes: number) => {
    if (!transactionType) return baseMinutes;
    if (transactionType === 'Student Permit') return baseMinutes * 1.25;
    if (transactionType === 'License Renewal') return baseMinutes * 0.8;
    if (transactionType === 'Vehicle Registration') return baseMinutes * 1.5;
    return baseMinutes;
  };

  const value = useMemo(() => ({
    isDark, toggleTheme,
    isDemoMode, toggleDemoMode,
    demoDistanceKm, setDemoDistanceKm,
    demoAddedWaitMins, setDemoAddedWaitMins,
    transactionType, setTransactionType,
    getAdjustedWaitTime
  }), [isDark, isDemoMode, demoDistanceKm, demoAddedWaitMins, transactionType]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
