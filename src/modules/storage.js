/**
 * Osu!rea - Storage Module
 * Preferences and favorites management with localStorage
 * @module storage
 */

import { generateId } from './utils.js';
import { DEFAULT_TABLET, DEFAULT_AREA, STORAGE_KEYS } from '../constants/index.js';

/**
 * @typedef {Object} Tablet
 * @property {string} brand - Tablet manufacturer brand
 * @property {string} model - Tablet model name
 * @property {number} width - Tablet width in mm
 * @property {number} height - Tablet height in mm
 * @property {boolean} isCustom - Whether this is a custom tablet
 */

/**
 * @typedef {Object} Area
 * @property {number} width - Area width in mm
 * @property {number} height - Area height in mm
 * @property {number} x - Center X position in mm
 * @property {number} y - Center Y position in mm
 * @property {number} radius - Corner radius percentage (0-100)
 * @property {boolean} [ratioLocked] - Whether aspect ratio is locked
 * @property {number} [ratio] - Current aspect ratio
 */

/**
 * @typedef {Object} UIPrefs
 * @property {'dark'|'light'} theme - Current theme
 * @property {string} locale - Current locale code
 * @property {boolean} gridVisible - Whether grid is visible
 */

/**
 * @typedef {Object} Preferences
 * @property {Tablet} tablet - Tablet configuration
 * @property {Area} area - Area configuration
 * @property {UIPrefs} ui - UI preferences
 */

/**
 * @typedef {Object} Favorite
 * @property {string} id - Unique identifier
 * @property {string} name - User-defined name
 * @property {string} [comment] - User comment/note
 * @property {Tablet} tablet - Tablet configuration
 * @property {Area} area - Area configuration
 * @property {string} createdAt - ISO date string
 */

const PREFS_KEY = STORAGE_KEYS.PREFS;
const FAVORITES_KEY = STORAGE_KEYS.FAVORITES;

/**
 * Default preferences
 */
const DEFAULT_PREFS = {
  tablet: { ...DEFAULT_TABLET },
  area: { ...DEFAULT_AREA, ratioLocked: true, ratio: 1.6 },
  ui: {
    theme: 'dark',
    locale: 'en',
    gridVisible: true,
  },
};

/**
 * Deep merge objects
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ============================================
// PREFERENCES
// ============================================

/**
 * Load preferences from localStorage
 * @returns {object}
 */
export function loadPrefs() {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return deepMerge(DEFAULT_PREFS, parsed);
    }
  } catch (e) {
    console.warn('Failed to load preferences:', e);
  }
  return { ...DEFAULT_PREFS };
}

/**
 * Save preferences to localStorage
 * @param {object} prefs
 */
export function savePrefs(prefs) {
  try {
    const merged = deepMerge(DEFAULT_PREFS, prefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('Failed to save preferences:', e);
  }
}

/**
 * Update specific preference path
 * @param {string} path - Dot notation path (e.g., "area.width")
 * @param {*} value
 */
export function updatePref(path, value) {
  const prefs = loadPrefs();
  const keys = path.split('.');
  let current = prefs;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  savePrefs(prefs);
}

/**
 * Get specific preference value
 * @param {string} path - Dot notation path
 * @param {*} defaultValue
 * @returns {*}
 */
export function getPref(path, defaultValue = null) {
  const prefs = loadPrefs();
  const keys = path.split('.');
  let current = prefs;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }

  return current;
}

// ============================================
// FAVORITES
// ============================================

/**
 * Get all favorites
 * @returns {Array}
 */
export function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load favorites:', e);
  }
  return [];
}

/**
 * Save favorites array
 * @param {Array} favorites
 */
function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.warn('Failed to save favorites:', e);
  }
}

/**
 * Add a new favorite
 * @param {object} config - { name, tablet, area }
 * @returns {object} - Created favorite with id and createdAt
 */
export function addFavorite(config) {
  const favorites = getFavorites();

  const favorite = {
    id: generateId(),
    name: config.name || 'Untitled',
    comment: config.comment || '',
    tablet: {
      brand: config.tablet?.brand || '',
      model: config.tablet?.model || '',
      width: config.tablet?.width || 0,
      height: config.tablet?.height || 0,
      isCustom: config.tablet?.isCustom || false,
    },
    area: {
      width: config.area?.width || 0,
      height: config.area?.height || 0,
      x: config.area?.x || 0,
      y: config.area?.y || 0,
      radius: config.area?.radius || 0,
      ratio: config.area?.ratio || 1,
    },
    createdAt: new Date().toISOString(),
  };

  favorites.unshift(favorite);
  saveFavorites(favorites);

  return favorite;
}

/**
 * Update an existing favorite
 * @param {string} id
 * @param {object} updates
 * @returns {object|null}
 */
export function updateFavorite(id, updates) {
  const favorites = getFavorites();
  const index = favorites.findIndex(f => f.id === id);

  if (index === -1) return null;

  favorites[index] = {
    ...favorites[index],
    ...updates,
    id: favorites[index].id,
    createdAt: favorites[index].createdAt,
  };

  saveFavorites(favorites);
  return favorites[index];
}

/**
 * Delete a favorite
 * @param {string} id
 * @returns {boolean}
 */
export function removeFavorite(id) {
  const favorites = getFavorites();
  const filtered = favorites.filter(f => f.id !== id);

  if (filtered.length === favorites.length) {
    return false;
  }

  saveFavorites(filtered);
  return true;
}

/**
 * Get a single favorite by ID
 * @param {string} id
 * @returns {object|null}
 */
export function getFavorite(id) {
  const favorites = getFavorites();
  return favorites.find(f => f.id === id) || null;
}

// ============================================
// THEME (thin wrappers used by themeController)
// ============================================

/**
 * Get current theme
 * @returns {'dark'|'light'}
 */
export function getTheme() {
  return getPref('ui.theme', 'dark');
}

/**
 * Set theme
 * @param {'dark'|'light'} theme
 */
export function setTheme(theme) {
  updatePref('ui.theme', theme);
}
