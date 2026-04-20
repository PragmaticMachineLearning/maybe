import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    __theme?: {
      get: () => Theme;
      set: (theme: Theme) => void;
      getResolved: () => ResolvedTheme;
    };
  }
}

export function useTheme(): ThemeState {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Get initial theme from the pre-paint script
    return typeof window !== 'undefined' && window.__theme
      ? window.__theme.get()
      : 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    // Get initial resolved theme from the pre-paint script
    return typeof window !== 'undefined' && window.__theme
      ? window.__theme.getResolved()
      : 'light';
  });

  // Update resolved theme when system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (window.__theme) {
        const currentTheme = window.__theme.get();
        const currentResolved = window.__theme.getResolved();
        
        setThemeState(currentTheme);
        setResolvedTheme(currentResolved);
      }
    };

    // Listen for system theme changes
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    if (typeof window !== 'undefined' && window.__theme) {
      // Use the pre-paint script's set function for instant switching
      window.__theme.set(newTheme);
      setThemeState(newTheme);
      setResolvedTheme(window.__theme.getResolved());
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
} 
