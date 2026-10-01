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
 * Half extents of an area's bounding box, rotation included
 * @param {{width: number, height: number, rotation?: number}} area
 * @returns {{halfW: number, halfH: number}}
 */
export function getHalfExtents(area) {
  const rad = ((area.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    halfW: (area.width * cos + area.height * sin) / 2,
    halfH: (area.width * sin + area.height * cos) / 2,
  };
}

/**
 * Clamp an area's centre so its rotated box stays on the tablet. A box
 * larger than the tablet is centred on that axis.
 * @param {Object} area - { width, height, x, y, rotation? }
 * @param {{width: number, height: number}} tablet
 * @returns {{x: number, y: number}}
 */
export function clampCentre(area, tablet, x = area.x, y = area.y) {
  const { halfW, halfH } = getHalfExtents(area);
  return {
    x: halfW * 2 >= tablet.width ? tablet.width / 2 : clamp(x, halfW, tablet.width - halfW),
    y: halfH * 2 >= tablet.height ? tablet.height / 2 : clamp(y, halfH, tablet.height - halfH),
  };
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
 * Format a number for an input field: up to 3 decimals, no trailing zeros
 * (76 → "76", 62.5 → "62.5", 47.123456 → "47.123")
 * @param {number} value
 * @returns {string}
 */
export function formatInputNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return String(Number(value.toFixed(3)));
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
