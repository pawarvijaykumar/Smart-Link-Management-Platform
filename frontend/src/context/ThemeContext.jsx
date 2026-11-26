import AppearanceContext, {
  AppearanceProvider,
  useAppearance,
  useTheme,
  DEFAULT_APPEARANCE,
  LIGHT_PRESETS,
  DARK_PRESETS,
  ACCENT_PRESETS,
  normalizeAppearance,
  resolveEffectiveTheme,
  resolveEffectivePreset,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
} from "./AppearanceContext";

export {
  AppearanceProvider as ThemeProvider,
  AppearanceProvider,
  useAppearance,
  useTheme,
  DEFAULT_APPEARANCE,
  LIGHT_PRESETS,
  DARK_PRESETS,
  ACCENT_PRESETS,
  normalizeAppearance,
  resolveEffectiveTheme,
  resolveEffectivePreset,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
};

export default AppearanceContext;
