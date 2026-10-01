/**
 * Osu!rea - Area Controller
 * Pure area maths on the app state: dimensions, ratio lock, position,
 * radius, rotation. The caller renders the result.
 * @module controllers/areaController
 */

import { clamp, clampCentre, getActiveArea } from '../modules/utils.js';

/** Smallest area side, in mm */
export const MIN_AREA_SIZE = 1;

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
 * Resolve a zone to its area object
 * @param {import('../modules/utils.js').AppState} state
 * @param {'A'|'B'} [zone] - Defaults to the active zone
 */
function areaOf(state, zone) {
  if (!zone) return getActiveArea(state);
  return zone === 'A' ? state.area : state.areaB;
}

/**
 * Clamp area position so the area, rotation included, stays on the tablet
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {'A'|'B'} [zone] - Optional zone (defaults to activeZone)
 */
export function clampAreaPosition(state, zone) {
  if (!state.tablet) return;
  const area = areaOf(state, zone);
  Object.assign(area, clampCentre(area, state.tablet));
}

/**
 * Shrink an area that no longer fits its tablet (keeping its ratio when
 * the ratio is locked), then clamp its position.
 * @param {import('../modules/utils.js').AppState} state
 * @param {'A'|'B'} [zone]
 */
export function fitAreaToTablet(state, zone) {
  if (!state.tablet) return;
  const area = areaOf(state, zone);
  const { width: tw, height: th } = state.tablet;

  if (state.lockRatio) {
    const factor = Math.min(1, tw / area.width, th / area.height);
    area.width *= factor;
    area.height *= factor;
  } else {
    area.width = Math.min(area.width, tw);
    area.height = Math.min(area.height, th);
  }
  clampAreaPosition(state, zone);
}

/**
 * Center the area within the tablet
 * @param {import('../modules/utils.js').AppState} state
 * @param {'A'|'B'} [zone]
 */
export function centerArea(state, zone) {
  if (!state.tablet) return;
  const area = areaOf(state, zone);
  area.x = state.tablet.width / 2;
  area.y = state.tablet.height / 2;
}

/**
 * Set area to full tablet size. With the ratio locked, the area keeps its
 * current ratio and grows to the largest size that fits.
 * @param {import('../modules/utils.js').AppState} state
 */
export function setFullArea(state) {
  if (!state.tablet) return;
  const area = getActiveArea(state);
  const { width: tw, height: th } = state.tablet;

  if (state.lockRatio) {
    const ratio = area.width / area.height;
    if (tw / th > ratio) {
      area.height = th;
      area.width = th * ratio;
    } else {
      area.width = tw;
      area.height = tw / ratio;
    }
  } else {
    area.width = tw;
    area.height = th;
  }
  centerArea(state);
}

/**
 * Update area dimensions. With the ratio locked, the edited side drives the
 * other one, using the area's current ratio.
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} width
 * @param {number} height
 * @param {'width'|'height'} [changed='width'] - The side the user edited
 */
export function updateAreaDimensions(state, width, height, changed = 'width') {
  if (!state.tablet) return;
  const area = getActiveArea(state);
  const { width: tw, height: th } = state.tablet;

  let w = clamp(width, MIN_AREA_SIZE, tw);
  let h = clamp(height, MIN_AREA_SIZE, th);

  if (state.lockRatio) {
    const ratio = area.width / area.height;
    if (changed === 'height') {
      w = h * ratio;
      if (w > tw) {
        w = tw;
        h = w / ratio;
      }
    } else {
      h = w / ratio;
      if (h > th) {
        h = th;
        w = h * ratio;
      }
    }
  }

  area.width = w;
  area.height = h;
  clampAreaPosition(state);
}

/**
 * Update area position (center) from x/y values
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} x
 * @param {number} y
 */
export function updateAreaPosition(state, x, y) {
  if (!state.tablet) return;
  const area = getActiveArea(state);
  area.x = x;
  area.y = y;
  clampAreaPosition(state);
}

/**
 * Update area radius
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} radius - New radius (0-100)
 * @param {boolean} snap - Whether to snap to key points
 * @returns {number} - The final radius value (possibly snapped)
 */
export function updateRadius(state, radius, snap = false) {
  let finalRadius = clamp(Math.round(radius), 0, 100);
  if (snap) finalRadius = snapToPoint(finalRadius, [0, 50, 100], 2);
  getActiveArea(state).radius = finalRadius;
  return finalRadius;
}

/**
 * Update area rotation
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} rotation - New rotation (-180 to 180)
 * @param {boolean} snap - Whether to snap to key angles
 * @returns {number} - The final rotation value (possibly snapped)
 */
export function updateRotation(state, rotation, snap = false) {
  let finalRotation = clamp(Math.round(rotation), -180, 180);
  if (snap) finalRotation = snapToPoint(finalRotation, [-180, -90, 0, 90, 180], 2);
  getActiveArea(state).rotation = finalRotation;
  clampAreaPosition(state);
  return finalRotation;
}

/**
 * Apply a preset ratio to the active area, keeping its width when it fits
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} targetRatio - Width / height
 */
export function applyRatioPreset(state, targetRatio) {
  if (!state.tablet || !(targetRatio > 0)) return;
  const area = getActiveArea(state);
  const { width: tw, height: th } = state.tablet;

  let w = area.width;
  let h = w / targetRatio;
  if (h > th) {
    h = th;
    w = h * targetRatio;
  }
  if (w > tw) {
    w = tw;
    h = w / targetRatio;
  }
  area.width = w;
  area.height = h;
  clampAreaPosition(state);
}
