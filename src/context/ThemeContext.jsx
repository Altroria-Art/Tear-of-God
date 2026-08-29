import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isLightMode, setIsLightMode] = useState(() => {
    // Check local storage first
    const saved = localStorage.getItem('tog-theme');
    if (saved) return saved === 'light';
    // If no saved preference, check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    // Fallback default
    return false;
  });

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-theme');
      localStorage.setItem('tog-theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('tog-theme', 'dark');
    }
  }, [isLightMode]);

  const toggleTheme = () => setIsLightMode(!isLightMode);

  return (
    <ThemeContext.Provider value={{ isLightMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}


