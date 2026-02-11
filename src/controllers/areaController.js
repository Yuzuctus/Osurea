/**
 * Osu!rea - Area Controller
 * Handles area manipulation, dimension updates, and position clamping
 * @module controllers/areaController
 */

import { clamp, getActiveArea, getActiveLockedRatio, syncActiveArea, formatNumber, calculateRatioString } from '../modules/utils.js';
import { setArea, setAreaB, setAreaRadius, setAreaRotation } from '../modules/visualizer.js';

/**
 * Snap value to nearest snap point if within threshold
 * @param {number} value - Current value
 * @param {number[]} snapPoints - Array of snap points
 * @param {number} threshold - Distance threshold for snapping
 * @returns {number} - Snapped value or original
 */
export function snapToPoint(value, snapPoints, threshold = 5) {
  for (const point of snapPoints) {
    if (Math.abs(value - point) <= threshold) {
      return point;
    }
  }
  return value;
}

/**
 * Clamp area position within tablet bounds
 * @param {import('../modules/utils.js').AppState} state - App state
 */
/**
 * Clamp area position within tablet bounds
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {'A'|'B'} [zone] - Optional zone override (defaults to activeZone)
 */
export function clampAreaPosition(state, zone) {
  if (!state.tablet) return;

  const area = zone
    ? (zone === 'A' ? state.area : state.areaB)
    : getActiveArea(state);
  const halfW = area.width / 2;
  const halfH = area.height / 2;

  area.x = clamp(area.x, halfW, state.tablet.width - halfW);
  area.y = clamp(area.y, halfH, state.tablet.height - halfH);
}

/**
 * Center the area within the tablet
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onUpdate - Called after update with activeArea
 */
export function centerArea(state, callbacks = {}) {
  if (!state.tablet) return;

  const activeArea = getActiveArea(state);
  activeArea.x = state.tablet.width / 2;
  activeArea.y = state.tablet.height / 2;

  syncActiveArea(state, setArea, setAreaB);
  
  if (callbacks.onUpdate) {
    callbacks.onUpdate(activeArea);
  }
}

/**
 * Set area to full tablet size (respecting locked ratio if enabled)
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onUpdate - Called after update
 */
export function setFullArea(state, callbacks = {}) {
  if (!state.tablet) return;

  const activeArea = getActiveArea(state);

  if (state.lockRatio) {
    const targetRatio = getActiveLockedRatio(state);
    const tabletRatio = state.tablet.width / state.tablet.height;

    if (tabletRatio > targetRatio) {
      activeArea.height = state.tablet.height;
      activeArea.width = activeArea.height * targetRatio;
    } else {
      activeArea.width = state.tablet.width;
      activeArea.height = activeArea.width / targetRatio;
    }
  } else {
    activeArea.width = state.tablet.width;
    activeArea.height = state.tablet.height;
  }

  activeArea.x = state.tablet.width / 2;
  activeArea.y = state.tablet.height / 2;

  syncActiveArea(state, setArea, setAreaB);

  if (callbacks.onUpdate) {
    callbacks.onUpdate(activeArea);
  }
}

/**
 * Update area dimensions from width/height values
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {number} width - New width
 * @param {number} height - New height
 * @param {Object} callbacks - Callback functions
 */
export function updateAreaDimensions(state, width, height, callbacks = {}) {
  if (!state.tablet) return;

  const activeArea = getActiveArea(state);

  // Clamp to tablet bounds
  let newWidth = clamp(width, 1, state.tablet.width);
  let newHeight = clamp(height, 1, state.tablet.height);

  // Keep aspect ratio if locked
  if (state.lockRatio) {
    const targetRatio = getActiveLockedRatio(state);
    newHeight = newWidth / targetRatio;
    if (newHeight > state.tablet.height) {
      newHeight = state.tablet.height;
      newWidth = newHeight * targetRatio;
    }
  }

  activeArea.width = newWidth;
  activeArea.height = newHeight;

  clampAreaPosition(state);
  syncActiveArea(state, setArea, setAreaB);

  if (callbacks.onUpdate) {
    callbacks.onUpdate(activeArea);
  }
}

/**
 * Update area position from x/y values
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {number} x - New X position
 * @param {number} y - New Y position
 * @param {Object} callbacks - Callback functions
 */
export function updateAreaPosition(state, x, y, callbacks = {}) {
  if (!state.tablet) return;

  const activeArea = getActiveArea(state);
  activeArea.x = x;
  activeArea.y = y;

  clampAreaPosition(state);
  syncActiveArea(state, setArea, setAreaB);

  if (callbacks.onUpdate) {
    callbacks.onUpdate(activeArea);
  }
}

/**
 * Update area radius
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {number} radius - New radius (0-100)
 * @param {boolean} snap - Whether to snap to key points
 * @returns {number} - The final radius value (possibly snapped)
 */
export function updateRadius(state, radius, snap = false) {
  let finalRadius = clamp(radius, 0, 100);

  if (snap) {
    finalRadius = snapToPoint(finalRadius, [0, 50, 100], 2);
  }

  const activeArea = getActiveArea(state);
  activeArea.radius = finalRadius;
  setAreaRadius(finalRadius);

  return finalRadius;
}

/**
 * Update area rotation
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {number} rotation - New rotation (-180 to 180)
 * @param {boolean} snap - Whether to snap to key angles
 * @returns {number} - The final rotation value (possibly snapped)
 */
export function updateRotation(state, rotation, snap = false) {
  let finalRotation = clamp(rotation, -180, 180);

  if (snap) {
    finalRotation = snapToPoint(finalRotation, [-180, -90, 0, 90, 180], 2);
  }

  const activeArea = getActiveArea(state);
  activeArea.rotation = finalRotation;
  setAreaRotation(finalRotation);

  return finalRotation;
}

/**
 * Apply a preset ratio to the active area
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {number} targetRatio - Target aspect ratio
 * @param {Object} callbacks - Callback functions
 */
export function applyRatioPreset(state, targetRatio, callbacks = {}) {
  if (!state.tablet) return;

  const activeArea = getActiveArea(state);
  const currentWidth = activeArea.width;
  let newHeight = currentWidth / targetRatio;

  // Clamp to tablet bounds
  if (newHeight > state.tablet.height) {
    newHeight = state.tablet.height;
    activeArea.width = newHeight * targetRatio;
  }

  activeArea.height = newHeight;
  clampAreaPosition(state);
  syncActiveArea(state, setArea, setAreaB);

  if (callbacks.onUpdate) {
    callbacks.onUpdate(activeArea);
  }
}

/**
 * Calculate ratio display string for active area
 * @param {import('../modules/utils.js').AppState} state - App state
 * @returns {string} - Ratio string (e.g., "16:9")
 */
export function getActiveRatioString(state) {
  const activeArea = getActiveArea(state);
  return calculateRatioString(activeArea.width, activeArea.height);
}

/**
 * Get formatted area dimensions string
 * @param {import('../modules/utils.js').AppState} state - App state
 * @returns {string} - Dimensions string (e.g., "100.0 × 62.5")
 */
export function getAreaDimensionsString(state) {
  const activeArea = getActiveArea(state);
  return `${formatNumber(activeArea.width, 1)} × ${formatNumber(activeArea.height, 1)}`;
}
