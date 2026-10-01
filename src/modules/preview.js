/**
 * Osu!rea - Preview Module
 * Small SVG preview of a tablet and its area (favorites, pro players)
 * @module preview
 */

import { clampCentre } from './utils.js';

/**
 * Generate an SVG preview of a tablet area, rotation and corner radius included
 * @param {Object} tablet - Tablet dimensions { width, height }
 * @param {Object} area - Area config { x, y, width, height, radius?, rotation? }
 * @returns {string} - SVG markup string
 */
export function generatePreview(tablet, area) {
  const scale = 100 / Math.max(tablet.width, tablet.height, 1);
  const w = tablet.width * scale;
  const h = tablet.height * scale;

  const areaW = area.width * scale;
  const areaH = area.height * scale;
  const centre = clampCentre(area, tablet);
  const cx = centre.x * scale;
  const cy = centre.y * scale;
  const r = ((area.radius || 0) / 100) * (Math.min(areaW, areaH) / 2);
  const f = n => Number(n.toFixed(2));

  return `<svg viewBox="0 0 ${f(w)} ${f(h)}" class="os-preview" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <rect x="0" y="0" width="${f(w)}" height="${f(h)}" class="os-preview__tablet"/>
    <rect x="${f(cx - areaW / 2)}" y="${f(cy - areaH / 2)}" width="${f(areaW)}" height="${f(areaH)}" rx="${f(r)}"
      transform="rotate(${area.rotation || 0} ${f(cx)} ${f(cy)})" class="os-preview__area"/>
  </svg>`;
}
