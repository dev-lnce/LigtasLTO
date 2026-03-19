import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'ligtaslto_theme';
const applyHtmlDarkClass = (isDark: boolean) => {
  // FIX 4: Use <html> class for dark mode so Tailwind `dark:` variants work globally.
  try {
    document.documentElement.classList.toggle('dark', isDark);
  } catch {}
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // FIX 4: Hydrate theme from localStorage and sync to <html> on mount.
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
  }, []);

  useEffect(() => {
    // FIX 4: Persist theme and keep <html> class in sync whenever it changes.
    applyHtmlDarkClass(isDark);
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  const toggleTheme = () => setIsDark((v) => !v); // FIX 4: Toggle via state updater to avoid stale closures.

  const value = useMemo(() => ({ isDark, toggleTheme }), [isDark]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
