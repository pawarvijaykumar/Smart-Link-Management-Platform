import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

export const STORAGE_KEY = "smartlink.appearance";
export const LEGACY_STORAGE_KEY = "smartlink-appearance";

export const LIGHT_PRESETS = [
  {
    id: "cream",
    name: "Cream",
    isDefault: true,
    colors: { bg: "#FAF7F2", surface: "#FFFFFF", surface2: "#F3EDE4", border: "#E8DFD3" },
  },
  {
    id: "paper",
    name: "Paper",
    colors: { bg: "#FFFFFF", surface: "#FFFFFF", surface2: "#F5F5F4", border: "#E7E5E4" },
  },
  {
    id: "sand",
    name: "Sand",
    colors: { bg: "#F2E9DC", surface: "#FBF6EE", surface2: "#E9DCC8", border: "#DCCBB0" },
  },
  {
    id: "stone",
    name: "Stone",
    colors: { bg: "#F3F2EF", surface: "#FFFFFF", surface2: "#E9E7E2", border: "#DAD7D0" },
  },
];

export const DARK_PRESETS = [
  {
    id: "espresso",
    name: "Espresso",
    isDefault: true,
    colors: { bg: "#1F1814", surface: "#292019", surface2: "#33281F", border: "#43362B" },
  },
  {
    id: "charcoal",
    name: "Charcoal",
    colors: { bg: "#171717", surface: "#212121", surface2: "#2B2B2B", border: "#3A3A3A" },
  },
];

export const ACCENT_PRESETS = [
  {
    id: "brown",
    name: "Brown",
    light: { color: "#7A4A2B", hover: "#633A20", onPrimary: "#FFFFFF" },
    dark: { color: "#D9A066", hover: "#E3B47F", onPrimary: "#1C1511" },
  },
  {
    id: "terracotta",
    name: "Terracotta",
    light: { color: "#B4552D", hover: "#963F1E", onPrimary: "#FFFFFF" },
    dark: { color: "#E58B65", hover: "#ECA384", onPrimary: "#1C1511" },
  },
  {
    id: "olive",
    name: "Olive",
    light: { color: "#6B7A3A", hover: "#566230", onPrimary: "#FFFFFF" },
    dark: { color: "#A2B67C", hover: "#B5C695", onPrimary: "#1C1511" },
  },
  {
    id: "forest",
    name: "Forest",
    light: { color: "#2F6B4F", hover: "#255641", onPrimary: "#FFFFFF" },
    dark: { color: "#6EBA96", hover: "#86C8A8", onPrimary: "#1C1511" },
  },
  {
    id: "amber",
    name: "Amber",
    light: { color: "#9A6412", hover: "#7F520E", onPrimary: "#FFFFFF" },
    dark: { color: "#E5A852", hover: "#EDB96E", onPrimary: "#1C1511" },
  },
  {
    id: "slate-blue",
    name: "Slate blue",
    light: { color: "#3F5B73", hover: "#324A5F", onPrimary: "#FFFFFF" },
    dark: { color: "#7FA3C2", hover: "#96B5D0", onPrimary: "#1C1511" },
  },
];

export const DEFAULT_APPEARANCE = {
  theme: "light",          // "light" | "dark" | "system"
  preset: "cream",        // light: cream, paper, sand, stone; dark: espresso, charcoal
  accent: "brown",        // brown, terracotta, olive, forest, amber, slate-blue
  density: "comfortable",  // "comfortable" | "compact"
  sidebar: "expanded",    // "expanded" | "collapsed"
};

// Normalize and migrate appearance data
export function normalizeAppearance(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_APPEARANCE };
  const theme = ["light", "dark", "system"].includes(raw.theme) ? raw.theme : "light";
  
  // Migrate raw.bg to raw.preset if needed
  let preset = raw.preset || raw.bg || (theme === "dark" ? "espresso" : "cream");
  if (preset === "warm" || preset === "slate" || preset === "midnight" || preset === "graphite" || preset === "ink") {
    preset = theme === "dark" ? "espresso" : "cream";
  }

  let accent = raw.accent || "brown";
  if (accent === "sand" || accent === "indigo" || accent === "purple" || accent === "emerald") {
    accent = accent === "sand" ? "slate-blue" : accent === "emerald" ? "forest" : "brown";
  }

  const density = raw.density === "compact" ? "compact" : "comfortable";
  const sidebar = raw.sidebar === "collapsed" ? "collapsed" : "expanded";

  return { theme, preset, accent, density, sidebar };
}

export function resolveEffectiveTheme(theme) {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return theme === "dark" ? "dark" : "light";
}

export function resolveEffectivePreset(theme, preset) {
  const effTheme = resolveEffectiveTheme(theme);
  if (effTheme === "dark") {
    if (DARK_PRESETS.some((p) => p.id === preset)) return preset;
    return "espresso";
  }
  if (LIGHT_PRESETS.some((p) => p.id === preset)) return preset;
  return "cream";
}

const AppearanceContext = createContext({
  ...DEFAULT_APPEARANCE,
  effectiveTheme: "light",
  effectivePreset: "cream",
  setTheme: () => {},
  setPreset: () => {},
  setBg: () => {},
  setAccent: () => {},
  setDensity: () => {},
  setSidebar: () => {},
  updateAppearance: () => {},
});

export const AppearanceProvider = ({ children }) => {
  const [appearance, setAppearance] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        return normalizeAppearance(JSON.parse(stored));
      }
    } catch (_) {}
    return { ...DEFAULT_APPEARANCE };
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
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

  const effectivePreset = resolveEffectivePreset(effectiveTheme, appearance.preset);

  // Apply DOM attributes & persist on every change
  useEffect(() => {
    const docEl = document.documentElement;
    docEl.setAttribute("data-theme", effectiveTheme);
    docEl.setAttribute("data-preset", effectivePreset);
    docEl.setAttribute("data-bg", effectivePreset); // compatibility alias
    docEl.setAttribute("data-accent", appearance.accent);
    docEl.setAttribute("data-density", appearance.density);

    // Apply sidebar default class/attribute
    if (appearance.sidebar === "collapsed") {
      docEl.classList.add("sidebar-default-collapsed");
    } else {
      docEl.classList.remove("sidebar-default-collapsed");
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(appearance));
    } catch (_) {}
  }, [appearance, effectiveTheme, effectivePreset]);

  // Sync with backend asynchronously
  const syncToBackend = useCallback((nextState) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      let userId = null;
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const userObj = JSON.parse(storedUser);
          userId = userObj._id || userObj.userId;
        } catch (_) {}
      }

      if (!userId && token.includes(".")) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          userId = payload.userId || payload.id || payload._id;
        } catch (_) {}
      }

      if (userId) {
        axios.patch(
          `/api/v1/users/${userId}`,
          { appearance: nextState },
          { headers: { Authorization: `Bearer ${token}` } }
        ).then((res) => {
          if (res.data?.success && res.data?.user) {
            try {
              localStorage.setItem("user", JSON.stringify(res.data.user));
            } catch (_) {}
          }
        }).catch(() => {
          // Fallback to explicit localhost:5000 if needed
          axios.patch(
            `http://localhost:5000/api/v1/users/${userId}`,
            { appearance: nextState },
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => {});
        });
      }
    } catch (_) {}
  }, []);

  const updateAppearance = useCallback((updates) => {
    setAppearance((prev) => {
      let next = { ...prev, ...updates };

      // If theme changed, auto-adjust preset if current preset is incompatible with new theme
      if (updates.theme && updates.theme !== prev.theme) {
        const nextEffTheme = resolveEffectiveTheme(updates.theme);
        if (nextEffTheme === "dark" && !DARK_PRESETS.some((p) => p.id === next.preset)) {
          next.preset = "espresso";
        } else if (nextEffTheme === "light" && !LIGHT_PRESETS.some((p) => p.id === next.preset)) {
          next.preset = "cream";
        }
      }

      // If preset changed, ensure valid
      if (updates.preset || updates.bg) {
        const targetPreset = updates.preset || updates.bg;
        next.preset = targetPreset;
      }

      // If sidebar default changed, update localStorage
      if (updates.sidebar) {
        try {
          localStorage.setItem("smartlink_sidebar_collapsed", updates.sidebar === "collapsed" ? "true" : "false");
        } catch (_) {}
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(next));
      } catch (_) {}

      syncToBackend(next);
      return next;
    });
  }, [syncToBackend]);

  const setTheme = useCallback((theme) => updateAppearance({ theme }), [updateAppearance]);
  const setPreset = useCallback((preset) => updateAppearance({ preset }), [updateAppearance]);
  const setBg = useCallback((bg) => updateAppearance({ preset: bg }), [updateAppearance]);
  const setAccent = useCallback((accent) => updateAppearance({ accent }), [updateAppearance]);
  const setDensity = useCallback((density) => updateAppearance({ density }), [updateAppearance]);
  const setSidebar = useCallback((sidebar) => updateAppearance({ sidebar }), [updateAppearance]);

  const contextValue = {
    ...appearance,
    bg: effectivePreset, // alias for backwards compatibility
    effectiveTheme,
    effectivePreset,
    setTheme,
    setPreset,
    setBg,
    setAccent,
    setDensity,
    setSidebar,
    updateAppearance,
  };

  return (
    <AppearanceContext.Provider value={contextValue}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => useContext(AppearanceContext);
export const useTheme = () => useContext(AppearanceContext);

export default AppearanceContext;
