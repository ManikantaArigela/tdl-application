const SETTINGS_KEY = 'tdl.settings';

export const DENSITIES = ['comfortable', 'compact'];
export const SORT_OPTIONS = ['manual', 'priority', 'due'];
export const DEFAULT_PRIORITY = 'medium';

export const DEFAULT_SETTINGS = {
  // Appearance
  density: 'comfortable',
  reduceMotion: false,
  // Task preferences
  defaultPriority: DEFAULT_PRIORITY,
  defaultSort: 'manual',
  confirmDelete: true,
};

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/**
 * Settings are device-level (not per account): they live in localStorage and
 * survive sign-out on purpose. Broken or partial storage falls back to the
 * defaults so the app always renders with a complete shape.
 */
export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      density: pick(saved.density, DENSITIES, DEFAULT_SETTINGS.density),
      reduceMotion: Boolean(saved.reduceMotion),
      defaultPriority: pick(saved.defaultPriority, ['low', 'medium', 'high'], DEFAULT_SETTINGS.defaultPriority),
      defaultSort: pick(saved.defaultSort, SORT_OPTIONS, DEFAULT_SETTINGS.defaultSort),
      confirmDelete: saved.confirmDelete !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* settings are best-effort */
  }
}

export function clearSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* ignore */
  }
}
