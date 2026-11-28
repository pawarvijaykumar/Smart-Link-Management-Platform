// =============================================================================
// SmartLink In-Memory Analytics Cache (Stale-While-Revalidate)
// Keyed by page + timeframe range (+ optional id)
// Ensures instant rendering when switching between 7D, 30D, and All.
// =============================================================================

const cache = new Map();

export const analyticsCache = {
  get(key) {
    if (!key) return null;
    return cache.get(String(key)) || null;
  },
  set(key, data) {
    if (key && data !== undefined && data !== null) {
      cache.set(String(key), data);
    }
  },
  has(key) {
    return cache.has(String(key));
  },
  delete(key) {
    cache.delete(String(key));
  },
  clear() {
    cache.clear();
  },
};

export default analyticsCache;
