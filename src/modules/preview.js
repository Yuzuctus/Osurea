/**
 * Osu!rea - Preview Module
 * Shared SVG preview generation for tablet areas
 * @module preview
 */

/**
 * Generate SVG preview of a tablet area
 * @param {Object} tablet - Tablet dimensions { width, height }
 * @param {Object} area - Area config { x, y, width, height }
 * @param {string} [cssClass='favorite-preview'] - CSS class for the SVG
 * @returns {string} - SVG markup string
 */
export function generatePreview(tablet, area, cssClass = 'favorite-preview') {
  const scale = 100 / Math.max(tablet.width, tablet.height);
  const w = tablet.width * scale;
  const h = tablet.height * scale;

  const areaX = (area.x - area.width / 2) * scale;
  const areaY = (area.y - area.height / 2) * scale;
  const areaW = area.width * scale;
  const areaH = area.height * scale;

  const clampedX = Math.max(0, Math.min(areaX, w - areaW));
  const clampedY = Math.max(0, Math.min(areaY, h - areaH));

  return `
    <svg viewBox="0 0 ${w} ${h}" class="${cssClass}" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="${w}" height="${h}" class="preview-tablet"/>
      <rect x="${clampedX}" y="${clampedY}" width="${areaW}" height="${areaH}" class="preview-area" rx="2"/>
    </svg>
  `;
}
