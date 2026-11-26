import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";

export const STORAGE_KEY = "smartlink.range";
export const DEFAULT_TIME_RANGE = "30D";

export const TIME_RANGE_OPTIONS = [
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
  { value: "All", label: "All" },
];

/**
 * Normalizes any timeframe string into "7D", "30D", or "All".
 */
export function normalizeRange(raw) {
  if (!raw) return DEFAULT_TIME_RANGE;
  const s = String(raw).trim().toUpperCase();
  if (s === "7D") return "7D";
  if (s === "30D") return "30D";
  if (s === "ALL") return "All";
  return DEFAULT_TIME_RANGE;
}

/**
 * Converts range to lowercase for backend API query parameters ("7d" | "30d" | "all").
 */
export function toApiRange(raw) {
  const norm = normalizeRange(raw);
  return norm.toLowerCase();
}

const TimeRangeContext = createContext(null);

export function TimeRangeProvider({ children, initialRange }) {
  const [timeRange, setTimeRangeState] = useState(() => {
    if (initialRange) return normalizeRange(initialRange);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) return normalizeRange(stored);
      }
    } catch (_) {}
    return DEFAULT_TIME_RANGE;
  });

  const setTimeRange = useCallback((newRange) => {
    const normalized = normalizeRange(newRange);
    setTimeRangeState(normalized);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, normalized);
      }
    } catch (_) {}
  }, []);

  // Listen for storage events across tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setTimeRangeState(normalizeRange(e.newValue));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      timeRange,
      setTimeRange,
      apiRange: toApiRange(timeRange),
      options: TIME_RANGE_OPTIONS,
    }),
    [timeRange, setTimeRange]
  );

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  const context = useContext(TimeRangeContext);
  if (!context) {
    return {
      timeRange: DEFAULT_TIME_RANGE,
      setTimeRange: () => {},
      apiRange: "30d",
      options: TIME_RANGE_OPTIONS,
    };
  }
  return context;
}

export default TimeRangeContext;
