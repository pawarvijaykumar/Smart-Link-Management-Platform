import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "smartlink-appearance";

export const DEFAULT_APPEARANCE = {
  theme: "dark",        // "dark" | "light" | "system"
  bg: "slate",          // "midnight" | "graphite" | "slate" | "ink"
  accent: "indigo",     // "indigo" | "violet" | "teal" | "emerald" | "amber" | "rose"
  density: "comfortable", // "comfortable" | "compact"
  sidebar: "expanded",  // "expanded" | "collapsed"
  pattern: "auto",      // "auto" | "grid" | "dots" | "none"
};

const ThemeContext = createContext({
  ...DEFAULT_APPEARANCE,
  effectiveTheme: "dark",
  effectivePattern: "grid",
  setTheme: () => {},
  setBg: () => {},
  setAccent: () => {},
  setDensity: () => {},
  setSidebar: () => {},
  setPattern: () => {},
  updateAppearance: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [appearance, setAppearance] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_APPEARANCE, ...parsed };
      }
    } catch (_) {}
    return DEFAULT_APPEARANCE;
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  });

  // Listen to OS theme changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemIsDark(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  const effectiveTheme =
    appearance.theme === "system"
      ? systemIsDark
        ? "dark"
        : "light"
      : appearance.theme;

  const effectivePattern =
    appearance.pattern && appearance.pattern !== "auto"
      ? appearance.pattern
      : effectiveTheme === "dark"
      ? "grid"
      : "dots";

  // Apply DOM attributes and persist
  useEffect(() => {
    const docEl = document.documentElement;
    docEl.setAttribute("data-theme", effectiveTheme);
    docEl.setAttribute("data-bg", appearance.bg);
    docEl.setAttribute("data-accent", appearance.accent);
    docEl.setAttribute("data-density", appearance.density);
    docEl.setAttribute("data-pattern", effectivePattern);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    } catch (_) {}
  }, [appearance, effectiveTheme, effectivePattern]);

  const updateAppearance = useCallback((updates) => {
    setAppearance((prev) => {
      const next = { ...prev, ...updates };
      return next;
    });
  }, []);

  const setTheme = useCallback((theme) => updateAppearance({ theme }), [updateAppearance]);
  const setBg = useCallback((bg) => updateAppearance({ bg }), [updateAppearance]);
  const setAccent = useCallback((accent) => updateAppearance({ accent }), [updateAppearance]);
  const setDensity = useCallback((density) => updateAppearance({ density }), [updateAppearance]);
  const setSidebar = useCallback((sidebar) => updateAppearance({ sidebar }), [updateAppearance]);
  const setPattern = useCallback((pattern) => updateAppearance({ pattern }), [updateAppearance]);

  const contextValue = {
    ...appearance,
    effectiveTheme,
    effectivePattern,
    setTheme,
    setBg,
    setAccent,
    setDensity,
    setSidebar,
    setPattern,
    updateAppearance,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
