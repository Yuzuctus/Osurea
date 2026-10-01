/**
 * Osu!rea - Storage Module
 * Preferences, favorites and theme persistence with localStorage
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
 * @property {number} rotation - Rotation in degrees (-180 to 180)
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
const THEME_KEY = STORAGE_KEYS.THEME;

/**
 * Default preferences
 */
const DEFAULT_PREFS = {
  tablet: { ...DEFAULT_TABLET },
  area: { ...DEFAULT_AREA },
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

/**
 * Read a number, falling back when the value is missing or not finite.
 * Zero is a valid value (x = 0, rotation = 0), so `||` is not used.
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toNumber(value, fallback) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
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
      if (parsed && typeof parsed === 'object') {
        return deepMerge(DEFAULT_PREFS, parsed);
      }
    }
  } catch (e) {
    console.warn('Failed to load preferences:', e);
  }
  return deepMerge(DEFAULT_PREFS, {});
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
 * Normalize an area so every field is a finite number.
 * @param {object} [area]
 * @returns {Area}
 */
export function normalizeArea(area = {}) {
  return {
    width: toNumber(area.width, DEFAULT_AREA.width),
    height: toNumber(area.height, DEFAULT_AREA.height),
    x: toNumber(area.x, DEFAULT_AREA.x),
    y: toNumber(area.y, DEFAULT_AREA.y),
    radius: toNumber(area.radius, 0),
    rotation: toNumber(area.rotation, 0),
  };
}

/**
 * Normalize a tablet description.
 * @param {object} [tablet]
 * @returns {Tablet}
 */
export function normalizeTablet(tablet = {}) {
  return {
    brand: String(tablet.brand ?? ''),
    model: String(tablet.model ?? ''),
    width: toNumber(tablet.width, DEFAULT_TABLET.width),
    height: toNumber(tablet.height, DEFAULT_TABLET.height),
    isCustom: Boolean(tablet.isCustom),
  };
}

/**
 * Get all favorites (entries that are not objects are dropped).
 * @returns {Favorite[]}
 */
export function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter(f => f && typeof f === 'object' && f.id);
      }
    }
  } catch (e) {
    console.warn('Failed to load favorites:', e);
  }
  return [];
}

/**
 * Save favorites array
 * @param {Favorite[]} favorites
 */
function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    return true;
  } catch (e) {
    console.warn('Failed to save favorites:', e);
    return false;
  }
}

/**
 * Whether this browser lets the page keep data (private modes and blocked
 * site data throw on access)
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const key = 'osurea:probe';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a new favorite
 * @param {object} config - { name, comment, tablet, area }
 * @returns {Favorite|null} - Created favorite, or null when it could not be stored
 */
export function addFavorite(config) {
  const favorites = getFavorites();

  const favorite = {
    id: generateId(),
    name: config.name || 'Untitled',
    comment: config.comment || '',
    tablet: normalizeTablet(config.tablet),
    area: normalizeArea(config.area),
    createdAt: new Date().toISOString(),
  };

  favorites.unshift(favorite);
  return saveFavorites(favorites) ? favorite : null;
}

/**
 * Update an existing favorite
 * @param {string} id
 * @param {object} updates
 * @returns {Favorite|null}
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
 * @returns {Favorite|null}
 */
export function getFavorite(id) {
  const favorites = getFavorites();
  return favorites.find(f => f.id === id) || null;
}

// ============================================
// THEME
// ============================================

/**
 * Get the theme the user chose explicitly.
 * @returns {'dark'|'light'|null} - null when the system decides
 */
export function getTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === 'light' || theme === 'dark' ? theme : null;
  } catch {
    return null;
  }
}

/**
 * Remember the user's theme choice.
 * @param {'dark'|'light'} theme
 */
export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.warn('Failed to save theme:', e);
  }
}
