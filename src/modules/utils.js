/**
 * Osu!rea - Utility Functions
 * Shared helper functions across modules
 * @module utils
 */

import { COMMON_RATIOS, RATIO_TOLERANCE } from '../constants/index.js';

// Pre-compiled regex for HTML escaping (avoids regex creation on each call)
const HTML_ESCAPE_REGEX = /[&<>"']/g;
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for HTML insertion
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(HTML_ESCAPE_REGEX, char => HTML_ESCAPES[char]);
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay = 200) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function}
 */
export function throttle(fn, limit = 100) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Calculate aspect ratio as simplified string
 * Uses constants from the centralized constants file
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
export function calculateRatioString(width, height) {
  if (!width || !height) return '--:--';

  const ratio = width / height;

  // Check if close to a common ratio (within 1%)
  for (const common of COMMON_RATIOS) {
    if (Math.abs(ratio - common.ratio) < RATIO_TOLERANCE) {
      return `${common.w}:${common.h}`;
    }
  }

  // Otherwise, calculate GCD and simplify
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const w = Math.round(width * 100);
  const h = Math.round(height * 100);
  const divisor = gcd(w, h);

  const simplifiedW = Math.round(w / divisor);
  const simplifiedH = Math.round(h / divisor);

  // If numbers are too large, just show decimal ratio
  if (simplifiedW > 100 || simplifiedH > 100) {
    return `${ratio.toFixed(2)}:1`;
  }

  return `${simplifiedW}:${simplifiedH}`;
}

/**
 * Format number with specified decimals
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(value, decimals = 2) {
  if (typeof value !== 'number' || isNaN(value)) return '--';
  return value.toFixed(decimals);
}

/**
 * Generate unique ID using crypto API with fallback
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @typedef {Object} AreaState
 * @property {number} x - X position (center)
 * @property {number} y - Y position (center)
 * @property {number} width - Area width
 * @property {number} height - Area height
 * @property {number} [radius] - Corner radius (0-100)
 * @property {number} [rotation] - Rotation in degrees (-180 to 180)
 */

/**
 * @typedef {Object} AppState
 * @property {Object|null} tablet - Current tablet
 * @property {AreaState} area - Zone A area
 * @property {AreaState} areaB - Zone B area
 * @property {'A'|'B'} activeZone - Currently active zone
 * @property {boolean} comparisonMode - Whether comparison mode is on
 * @property {boolean} lockRatio - Whether aspect ratio is locked
 * @property {number} lockedRatio - Locked ratio for zone A
 * @property {number} lockedRatioB - Locked ratio for zone B
 * @property {boolean} showGrid - Whether grid is visible
 */

/**
 * Get the currently active area based on activeZone
 * @param {AppState} state - Application state
 * @returns {AreaState} - The active area (A or B)
 */
export function getActiveArea(state) {
  return state.activeZone === 'A' ? state.area : state.areaB;
}

/**
 * Get the locked ratio for the active zone
 * @param {AppState} state - Application state
 * @returns {number} - The locked ratio
 */
export function getActiveLockedRatio(state) {
  return state.activeZone === 'A' ? state.lockedRatio : state.lockedRatioB;
}

/**
 * Update the active area in the visualizer
 * @param {AppState} state - Application state
 * @param {Function} setArea - Function to update zone A
 * @param {Function} setAreaB - Function to update zone B
 */
export function syncActiveArea(state, setArea, setAreaB) {
  if (state.activeZone === 'A') {
    setArea(state.area);
  } else {
    setAreaB(state.areaB);
  }
}
