// =============================================================================
// CHANGE: Stage 13 A/B Testing Form Draft Persistence Utilities — 2026-11-18
// Preserves incomplete experiment name, Variant A and Variant B URLs,
// traffic split (50/50), status, and fallback variant across page navigation,
// component unmounts, and browser reloads.
// =============================================================================

export const DRAFT_STORAGE_KEY = "smartlink_ab_experiment_draft";
export const MODAL_OPEN_STORAGE_KEY = "smartlink_ab_modal_open";

export const DEFAULT_FORM_STATE = {
  name: "",
  variantA: "",
  variantB: "",
  trafficSplit: { a: 50, b: 50 },
  status: "active",
  fallbackVariant: "A",
};

/**
 * Loads the saved experiment creation draft from localStorage.
 * Returns default empty form state if no draft exists or if parsing fails.
 */
export const loadSavedDraft = () => {
  try {
    const storage = typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof global !== "undefined" && global.localStorage
      ? global.localStorage
      : null;

    if (!storage) return { ...DEFAULT_FORM_STATE };

    const saved = storage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        return {
          name: typeof parsed.name === "string" ? parsed.name : "",
          variantA: typeof parsed.variantA === "string" ? parsed.variantA : "",
          variantB: typeof parsed.variantB === "string" ? parsed.variantB : "",
          trafficSplit: parsed.trafficSplit || { a: 50, b: 50 },
          status: parsed.status === "draft" ? "draft" : "active",
          fallbackVariant: parsed.fallbackVariant === "B" ? "B" : "A",
        };
      }
    }
  } catch (err) {
    console.warn("Failed to load A/B experiment draft from storage:", err);
  }
  return { ...DEFAULT_FORM_STATE };
};

/**
 * Checks whether the experiment creation modal was open when navigating away.
 */
export const loadSavedModalOpen = () => {
  try {
    const storage = typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof global !== "undefined" && global.localStorage
      ? global.localStorage
      : null;

    if (!storage) return false;
    return storage.getItem(MODAL_OPEN_STORAGE_KEY) === "true";
  } catch (_) {
    return false;
  }
};

/**
 * Saves or clears incomplete draft data based on whether any field contains text.
 */
export const persistDraft = (formData) => {
  try {
    const storage = typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof global !== "undefined" && global.localStorage
      ? global.localStorage
      : null;

    if (!storage) return;

    const hasData = Boolean(
      formData?.name?.trim() ||
      formData?.variantA?.trim() ||
      formData?.variantB?.trim()
    );

    if (hasData) {
      storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    } else {
      storage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to persist A/B experiment draft:", err);
  }
};

/**
 * Records whether the creation modal is open.
 */
export const setModalOpenState = (isOpen) => {
  try {
    const storage = typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof global !== "undefined" && global.localStorage
      ? global.localStorage
      : null;

    if (!storage) return;
    storage.setItem(MODAL_OPEN_STORAGE_KEY, isOpen ? "true" : "false");
  } catch (_) {}
};

/**
 * Completely purges draft and modal open state from storage.
 */
export const clearDraftStorage = () => {
  try {
    const storage = typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof global !== "undefined" && global.localStorage
      ? global.localStorage
      : null;

    if (!storage) return;
    storage.removeItem(DRAFT_STORAGE_KEY);
    storage.removeItem(MODAL_OPEN_STORAGE_KEY);
  } catch (_) {}
};
