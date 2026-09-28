import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isLightMode, setIsLightMode] = useState(() => {
    // Check local storage first
    let saved;
    try { saved = localStorage.getItem('tog-theme'); } catch { /* Storage is optional. */ }
    if (saved) return saved === 'light';
    // If no saved preference, check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    // Fallback default
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (isLightMode) {
      body.classList.add('light-theme');
      body.classList.remove('dark');
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      body.classList.remove('light-theme');
      body.classList.add('dark');
      root.classList.add('dark');
      root.classList.remove('light');
    }
    try { localStorage.setItem('tog-theme', isLightMode ? 'light' : 'dark'); } catch { /* Keep the in-memory preference. */ }
  }, [isLightMode]);

  const toggleTheme = useCallback(() => setIsLightMode((prev) => !prev), []);

  const value = useMemo(() => ({ isLightMode, toggleTheme }), [isLightMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}


