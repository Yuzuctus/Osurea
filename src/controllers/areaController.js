/**
 * Osu!rea - Area Controller
 * Pure area maths on the app state: limits, dimensions, ratio, position,
 * radius, rotation. Every function keeps the area (rotation included) on the
 * tablet. The caller renders the result and explains adjustments.
 * @module controllers/areaController
 */

import { clamp, clampCentre, getActiveArea, getHalfExtents } from '../modules/utils.js';

/** Smallest area side, in mm */
export const MIN_AREA_SIZE = 1;

const EPSILON = 1e-9;

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
 * |cos| and |sin| of an area's rotation, with float noise removed
 * @param {Object} area
 */
function trig(area) {
  const rad = ((area.rotation || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return { c: c < EPSILON ? 0 : c, s: s < EPSILON ? 0 : s };
}

/**
 * Largest size an area with this ratio and rotation can have on the tablet
 * @param {number} ratio - width / height
 * @param {Object} area - Only its rotation is read
 * @param {{width: number, height: number}} tablet
 * @returns {{width: number, height: number}}
 */
export function maxSizeForRatio(ratio, area, tablet) {
  const { c, s } = trig(area);
  const height = Math.min(tablet.width / (ratio * c + s), tablet.height / (ratio * s + c));
  return { width: height * ratio, height };
}

/**
 * @typedef {'tablet'|'ratio'|'rotation'} LimitReason
 * @typedef {{min: number, max: number, reason: LimitReason}} Limit
 */

/**
 * Allowed width and height for the active area right now: with the ratio
 * locked, editing one side moves the other, so its limits follow.
 * @param {import('../modules/utils.js').AppState} state
 * @returns {{width: Limit, height: Limit}}
 */
export function getSizeLimits(state) {
  const area = getActiveArea(state);
  const { width: tw, height: th } = state.tablet;
  const { c, s } = trig(area);
  const rotated = s > EPSILON;

  if (state.lockRatio) {
    const ratio = area.width / area.height;
    const max = maxSizeForRatio(ratio, area, state.tablet);
    const reason = rotated ? 'rotation' : 'ratio';
    return {
      width: {
        min: Math.max(MIN_AREA_SIZE, MIN_AREA_SIZE * ratio),
        max: max.width,
        reason: !rotated && max.width >= tw - EPSILON ? 'tablet' : reason,
      },
      height: {
        min: Math.max(MIN_AREA_SIZE, MIN_AREA_SIZE / ratio),
        max: max.height,
        reason: !rotated && max.height >= th - EPSILON ? 'tablet' : reason,
      },
    };
  }

  // Unlocked: one side changes, the other stays. The rotated box is
  // (w·c + h·s) × (w·s + h·c) and must fit in tw × th.
  const maxWidth = Math.min(
    c > EPSILON ? (tw - area.height * s) / c : Infinity,
    s > EPSILON ? (th - area.height * c) / s : Infinity,
    tw
  );
  const maxHeight = Math.min(
    c > EPSILON ? (th - area.width * s) / c : Infinity,
    s > EPSILON ? (tw - area.width * c) / s : Infinity,
    th
  );
  const reason = rotated ? 'rotation' : 'tablet';
  return {
    width: { min: MIN_AREA_SIZE, max: Math.max(MIN_AREA_SIZE, maxWidth), reason },
    height: { min: MIN_AREA_SIZE, max: Math.max(MIN_AREA_SIZE, maxHeight), reason },
  };
}

/**
 * Allowed centre positions for the active area
 * @param {import('../modules/utils.js').AppState} state
 * @returns {{x: {min: number, max: number}, y: {min: number, max: number}}}
 */
export function getPositionLimits(state) {
  const area = getActiveArea(state);
  const { width: tw, height: th } = state.tablet;
  const { halfW, halfH } = getHalfExtents(area);
  const axis = (half, size) =>
    half * 2 >= size ? { min: size / 2, max: size / 2 } : { min: half, max: size - half };
  return { x: axis(halfW, tw), y: axis(halfH, th) };
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
 * Shrink an area that no longer fits its tablet, then clamp its position.
 * A straight, unlocked area loses only its overflowing side; otherwise the
 * area keeps its ratio.
 * @param {import('../modules/utils.js').AppState} state
 * @param {'A'|'B'} [zone]
 * @returns {boolean} - true when the area had to shrink
 */
export function fitAreaToTablet(state, zone) {
  if (!state.tablet) return false;
  const area = areaOf(state, zone);
  const { width: tw, height: th } = state.tablet;
  const before = { width: area.width, height: area.height };

  if (!state.lockRatio && trig(area).s <= EPSILON) {
    area.width = Math.min(area.width, tw);
    area.height = Math.min(area.height, th);
  } else {
    const { halfW, halfH } = getHalfExtents(area);
    const factor = Math.min(1, tw / (halfW * 2), th / (halfH * 2));
    area.width *= factor;
    area.height *= factor;
  }
  clampAreaPosition(state, zone);
  return area.width < before.width - 1e-6 || area.height < before.height - 1e-6;
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
 * Set area to full tablet size. With the ratio locked or a rotation, the
 * area keeps its ratio and grows to the largest size that fits.
 * @param {import('../modules/utils.js').AppState} state
 */
export function setFullArea(state) {
  if (!state.tablet) return;
  const area = getActiveArea(state);

  if (!state.lockRatio && trig(area).s <= EPSILON) {
    area.width = state.tablet.width;
    area.height = state.tablet.height;
  } else {
    Object.assign(area, maxSizeForRatio(area.width / area.height, area, state.tablet));
  }
  centerArea(state);
}

/**
 * Update one side of the area. With the ratio locked, the other side follows.
 * The value is brought within getSizeLimits().
 * @param {import('../modules/utils.js').AppState} state
 * @param {'width'|'height'} side - The side the user edited
 * @param {number} value
 */
export function setAreaSide(state, side, value) {
  if (!state.tablet) return;
  const area = getActiveArea(state);
  const limits = getSizeLimits(state)[side];
  const next = clamp(value, limits.min, limits.max);
  const ratio = area.width / area.height;

  if (side === 'width') {
    area.width = next;
    if (state.lockRatio) area.height = next / ratio;
  } else {
    area.height = next;
    if (state.lockRatio) area.width = next * ratio;
  }
  clampAreaPosition(state);
}

/**
 * Update area dimensions from width/height values (kept for callers that set
 * both sides; the side named by `changed` drives the other when locked)
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} width
 * @param {number} height
 * @param {'width'|'height'} [changed='width']
 */
export function updateAreaDimensions(state, width, height, changed = 'width') {
  setAreaSide(state, changed, changed === 'width' ? width : height);
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
 * Update area rotation; an area that no longer fits shrinks (keeping its ratio)
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} rotation - New rotation (-180 to 180)
 * @param {boolean} snap - Whether to snap to key angles
 * @returns {{rotation: number, shrunk: boolean}}
 */
export function updateRotation(state, rotation, snap = false) {
  let finalRotation = clamp(Math.round(rotation), -180, 180);
  if (snap) finalRotation = snapToPoint(finalRotation, [-180, -90, 0, 90, 180], 2);
  getActiveArea(state).rotation = finalRotation;
  const shrunk = fitAreaToTablet(state);
  return { rotation: finalRotation, shrunk };
}

/**
 * Give the active area a ratio, keeping its width when it fits
 * @param {import('../modules/utils.js').AppState} state
 * @param {number} targetRatio - Width / height
 * @returns {boolean} - true when the area had to shrink to fit
 */
export function applyRatioPreset(state, targetRatio) {
  if (!state.tablet || !(targetRatio > 0)) return false;
  const area = getActiveArea(state);
  const max = maxSizeForRatio(targetRatio, area, state.tablet);
  const width = Math.min(area.width, max.width);
  const shrunk = width < area.width - 1e-6;
  area.width = width;
  area.height = width / targetRatio;
  clampAreaPosition(state);
  return shrunk;
}

/**
 * Swap width and height (portrait ↔ landscape)
 * @param {import('../modules/utils.js').AppState} state
 * @returns {boolean} - true when the area had to shrink to fit
 */
export function swapDimensions(state) {
  if (!state.tablet) return false;
  const area = getActiveArea(state);
  [area.width, area.height] = [area.height, area.width];
  const locked = state.lockRatio;
  state.lockRatio = true; // shrink uniformly, whatever the lock
  const shrunk = fitAreaToTablet(state);
  state.lockRatio = locked;
  return shrunk;
}
