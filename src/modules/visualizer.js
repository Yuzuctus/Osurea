/**
 * Osu!rea - Visualizer Module
 * Canvas-like visualization using DOM elements
 * @module visualizer
 */

import { icon } from './icons.js';
import { throttle } from './utils.js';
import {
  MAX_VISUALIZER_SCALE,
  VISUALIZER_PADDING,
  RESIZE_THROTTLE_DELAY,
} from '../constants/index.js';

/**
 * @typedef {Object} VisualizerState
 * @property {Object} tablet - Tablet dimensions
 * @property {number} tablet.width - Tablet width in mm
 * @property {number} tablet.height - Tablet height in mm
 * @property {Object} area - Active area configuration
 * @property {number} area.width - Area width in mm
 * @property {number} area.height - Area height in mm
 * @property {number} area.x - Center X position in mm
 * @property {number} area.y - Center Y position in mm
 * @property {number} area.radius - Corner radius percentage
 * @property {number} area.rotation - Rotation angle in degrees
 * @property {Object} areaB - Zone B area configuration (comparison mode)
 * @property {boolean} comparisonMode - Whether comparison mode is enabled
 * @property {string} activeZone - Active zone ('A' or 'B')
 * @property {number} scale - Current display scale
 * @property {boolean} isDragging - Whether area is being dragged
 * @property {Object} dragOffset - Drag offset coordinates
 * @property {boolean} gridVisible - Whether grid is visible
 */

// DOM element references (cached)
let container = null;
let tabletBoundary = null;
let areaRectangle = null;
let areaRectangleB = null;
let gridElement = null;
let contextMenu = null;

// Cached container dimensions
let cachedContainerRect = null;

const state = {
  tablet: { width: 152, height: 95 },
  area: { width: 76, height: 47.5, x: 76, y: 47.5, radius: 0, rotation: 0 },
  areaB: { width: 76, height: 47.5, x: 76, y: 47.5, radius: 0, rotation: 0 },
  comparisonMode: false,
  activeZone: 'A',
  scale: 1,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  gridVisible: true,
};

let onAreaChange = null;

/**
 * Invalidate cached container dimensions
 */
function invalidateCache() {
  cachedContainerRect = null;
}

/**
 * Get container rect (cached)
 * @returns {DOMRect|null}
 */
function getContainerRect() {
  if (!container) return null;
  if (!cachedContainerRect) {
    cachedContainerRect = container.getBoundingClientRect();
  }
  return cachedContainerRect;
}

/**
 * Calculate scale to fit tablet in container
 * @returns {number} - Scale factor
 */
function calculateScale() {
  if (!container || !state.tablet.width || !state.tablet.height) return 1;

  const containerRect = getContainerRect();
  if (!containerRect) return 1;

  const availableWidth = containerRect.width - VISUALIZER_PADDING * 2;
  const availableHeight = containerRect.height - VISUALIZER_PADDING * 2;

  const scaleX = availableWidth / state.tablet.width;
  const scaleY = availableHeight / state.tablet.height;

  return Math.min(scaleX, scaleY, MAX_VISUALIZER_SCALE);
}

/**
 * Update tablet boundary display
 */
function updateTabletDisplay() {
  if (!tabletBoundary) return;

  state.scale = calculateScale();

  const displayWidth = state.tablet.width * state.scale;
  const displayHeight = state.tablet.height * state.scale;

  tabletBoundary.style.width = `${displayWidth}px`;
  tabletBoundary.style.height = `${displayHeight}px`;
}

/**
 * Update area rectangle display
 */
function updateAreaDisplay() {
  if (!areaRectangle || !tabletBoundary) return;

  const { width, height, x, y, radius, rotation } = state.area;
  const { scale } = state;

  // Calculate pixel dimensions
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  // Position relative to tablet boundary (x, y are center coordinates)
  const left = (x - width / 2) * scale;
  const top = (y - height / 2) * scale;

  areaRectangle.style.width = `${displayWidth}px`;
  areaRectangle.style.height = `${displayHeight}px`;
  areaRectangle.style.left = `${left}px`;
  areaRectangle.style.top = `${top}px`;

  // Calculate border-radius: 50% of smallest dimension at 100%
  const maxRadius = Math.min(width, height) / 2;
  const actualRadius = (radius / 100) * maxRadius * scale;
  areaRectangle.style.borderRadius = `${actualRadius}px`;

  // Apply rotation
  areaRectangle.style.transform = `rotate(${rotation || 0}deg)`;

  // Update active/inactive state in comparison mode
  if (state.comparisonMode) {
    areaRectangle.classList.toggle('inactive', state.activeZone !== 'A');
  } else {
    areaRectangle.classList.remove('inactive');
  }
}

/**
 * Update area rectangle B display (comparison mode)
 */
function updateAreaBDisplay() {
  if (!areaRectangleB || !tabletBoundary) return;

  if (!state.comparisonMode) {
    areaRectangleB.classList.add('hidden');
    return;
  }

  areaRectangleB.classList.remove('hidden');

  const { width, height, x, y, radius, rotation } = state.areaB;
  const { scale } = state;

  // Calculate pixel dimensions
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  // Position relative to tablet boundary (x, y are center coordinates)
  const left = (x - width / 2) * scale;
  const top = (y - height / 2) * scale;

  areaRectangleB.style.width = `${displayWidth}px`;
  areaRectangleB.style.height = `${displayHeight}px`;
  areaRectangleB.style.left = `${left}px`;
  areaRectangleB.style.top = `${top}px`;

  // Calculate border-radius
  const maxRadius = Math.min(width, height) / 2;
  const actualRadius = (radius / 100) * maxRadius * scale;
  areaRectangleB.style.borderRadius = `${actualRadius}px`;

  // Apply rotation
  areaRectangleB.style.transform = `rotate(${rotation || 0}deg)`;

  // Update active state
  areaRectangleB.classList.toggle('active', state.activeZone === 'B');
}

/**
 * Clamp area position within tablet bounds
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {Object} [areaOverride] - Optional area dims to use instead of active zone
 */
function clampPosition(x, y, areaOverride) {
  const activeArea = areaOverride || (state.activeZone === 'A' ? state.area : state.areaB);
  const { width: areaW, height: areaH } = activeArea;
  const { width: tabletW, height: tabletH } = state.tablet;

  const halfW = areaW / 2;
  const halfH = areaH / 2;

  return {
    x: Math.max(halfW, Math.min(tabletW - halfW, x)),
    y: Math.max(halfH, Math.min(tabletH - halfH, y)),
  };
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
  if (e.button !== 0) return; // Left click only

  e.preventDefault();
  state.isDragging = true;

  const activeRect = state.activeZone === 'A' ? areaRectangle : areaRectangleB;
  activeRect.classList.add('dragging');

  const rect = activeRect.getBoundingClientRect();
  const clientX = e.clientX || e.touches?.[0]?.clientX;
  const clientY = e.clientY || e.touches?.[0]?.clientY;

  state.dragOffset = {
    x: clientX - (rect.left + rect.width / 2),
    y: clientY - (rect.top + rect.height / 2),
  };

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchmove', handleDragMove, { passive: false });
  document.addEventListener('touchend', handleDragEnd);
}

/**
 * Handle drag move
 */
function handleDragMove(e) {
  if (!state.isDragging) return;

  e.preventDefault();

  const clientX = e.clientX || e.touches?.[0]?.clientX;
  const clientY = e.clientY || e.touches?.[0]?.clientY;

  const tabletRect = tabletBoundary.getBoundingClientRect();

  // Calculate new position in tablet coordinates
  const relativeX = (clientX - state.dragOffset.x - tabletRect.left) / state.scale;
  const relativeY = (clientY - state.dragOffset.y - tabletRect.top) / state.scale;

  // Clamp to bounds
  const clamped = clampPosition(relativeX, relativeY);

  // Update the active zone
  if (state.activeZone === 'A') {
    state.area.x = clamped.x;
    state.area.y = clamped.y;
    updateAreaDisplay();
  } else {
    state.areaB.x = clamped.x;
    state.areaB.y = clamped.y;
    updateAreaBDisplay();
  }
}

/**
 * Handle drag end
 */
function handleDragEnd() {
  if (!state.isDragging) return;

  state.isDragging = false;

  const activeRect = state.activeZone === 'A' ? areaRectangle : areaRectangleB;
  activeRect.classList.remove('dragging');

  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
  document.removeEventListener('touchmove', handleDragMove);
  document.removeEventListener('touchend', handleDragEnd);

  // Notify change with active zone info
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  if (onAreaChange) {
    onAreaChange({ ...activeArea }, state.activeZone);
  }

  // Dispatch event
  window.dispatchEvent(
    new CustomEvent('area-changed', {
      detail: { ...activeArea, zone: state.activeZone },
    })
  );
}

/**
 * Handle context menu (right-click)
 */
function handleContextMenu(e) {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
}

/**
 * Show alignment context menu
 */
function showContextMenu(x, y) {
  if (!contextMenu) return;

  contextMenu.classList.remove('hidden');

  // Position menu
  const menuRect = contextMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = x;
  let top = y;

  // Adjust if menu would go off screen
  if (x + menuRect.width > viewportWidth) {
    left = viewportWidth - menuRect.width - 10;
  }
  if (y + menuRect.height > viewportHeight) {
    top = viewportHeight - menuRect.height - 10;
  }

  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;
}

/**
 * Hide context menu
 */
function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.add('hidden');
  }
}

/**
 * Align area to a specific position
 */
export function alignArea(position) {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  const { width: areaW, height: areaH } = activeArea;
  const { width: tabletW, height: tabletH } = state.tablet;

  const halfW = areaW / 2;
  const halfH = areaH / 2;

  const positions = {
    'top-left': { x: halfW, y: halfH },
    top: { x: tabletW / 2, y: halfH },
    'top-right': { x: tabletW - halfW, y: halfH },
    left: { x: halfW, y: tabletH / 2 },
    center: { x: tabletW / 2, y: tabletH / 2 },
    right: { x: tabletW - halfW, y: tabletH / 2 },
    'bottom-left': { x: halfW, y: tabletH - halfH },
    bottom: { x: tabletW / 2, y: tabletH - halfH },
    'bottom-right': { x: tabletW - halfW, y: tabletH - halfH },
  };

  const newPos = positions[position];
  if (newPos) {
    if (state.activeZone === 'A') {
      state.area.x = newPos.x;
      state.area.y = newPos.y;
      updateAreaDisplay();
    } else {
      state.areaB.x = newPos.x;
      state.areaB.y = newPos.y;
      updateAreaBDisplay();
    }

    if (onAreaChange) {
      onAreaChange({ ...activeArea, x: newPos.x, y: newPos.y }, state.activeZone);
    }

    window.dispatchEvent(
      new CustomEvent('area-changed', {
        detail: { ...activeArea, x: newPos.x, y: newPos.y, zone: state.activeZone },
      })
    );
  }

  hideContextMenu();
}

/**
 * Center the area
 */
export function centerArea() {
  alignArea('center');
}

/**
 * Create context menu HTML
 */
function createContextMenu() {
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu hidden';

  menu.innerHTML = `
    <div class="context-menu-title">
      ${icon('crosshairs')}
      <span data-i18n="alignment.title">Area Positioning</span>
    </div>
    <div class="context-menu-grid">
      <button data-align="top-left" title="Top Left">${icon('alignTopLeft')}</button>
      <button data-align="top" title="Top">${icon('alignTop')}</button>
      <button data-align="top-right" title="Top Right">${icon('alignTopRight')}</button>
      <button data-align="left" title="Left">${icon('alignLeft')}</button>
      <button data-align="center" title="Center">${icon('alignCenter')}</button>
      <button data-align="right" title="Right">${icon('alignRight')}</button>
      <button data-align="bottom-left" title="Bottom Left">${icon('alignBottomLeft')}</button>
      <button data-align="bottom" title="Bottom">${icon('alignBottom')}</button>
      <button data-align="bottom-right" title="Bottom Right">${icon('alignBottomRight')}</button>
    </div>
  `;

  // Add click handlers
  menu.querySelectorAll('[data-align]').forEach(btn => {
    btn.addEventListener('click', () => {
      alignArea(btn.dataset.align);
    });
  });

  document.body.appendChild(menu);
  return menu;
}

/**
 * Initialize visualizer
 * @param {HTMLElement} containerEl - Container element
 * @param {Function} onChange - Callback when area changes
 */
export function initVisualizer(containerEl, onChange = null) {
  container = containerEl;
  onAreaChange = onChange;

  // Create structure
  container.innerHTML = `
    <div class="visualizer-grid" id="visualizer-grid"></div>
    <div class="tablet-boundary" id="tablet-boundary">
      <div class="area-rectangle" id="area-rectangle"></div>
      <div class="area-rectangle-b hidden" id="area-rectangle-b"></div>
    </div>
    <div class="visualizer-loading hidden" id="visualizer-loading">
      <div class="spinner"></div>
    </div>
  `;

  tabletBoundary = container.querySelector('#tablet-boundary');
  areaRectangle = container.querySelector('#area-rectangle');
  areaRectangleB = container.querySelector('#area-rectangle-b');
  gridElement = container.querySelector('#visualizer-grid');

  // Create context menu
  contextMenu = createContextMenu();

  // Event listeners for Zone A
  areaRectangle.addEventListener('mousedown', e => {
    if (state.comparisonMode && state.activeZone !== 'A') return;
    handleDragStart(e);
  });
  areaRectangle.addEventListener(
    'touchstart',
    e => {
      if (state.comparisonMode && state.activeZone !== 'A') return;
      handleDragStart(e);
    },
    { passive: false }
  );

  // Event listeners for Zone B
  areaRectangleB.addEventListener('mousedown', e => {
    if (state.activeZone !== 'B') return;
    handleDragStart(e);
  });
  areaRectangleB.addEventListener(
    'touchstart',
    e => {
      if (state.activeZone !== 'B') return;
      handleDragStart(e);
    },
    { passive: false }
  );

  container.addEventListener('contextmenu', handleContextMenu);

  // Close context menu on click outside
  document.addEventListener('click', e => {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Handle resize with throttle for performance
  const throttledResize = throttle(() => {
    invalidateCache();
    updateTabletDisplay();
    updateAreaDisplay();
    updateAreaBDisplay();
  }, RESIZE_THROTTLE_DELAY);

  const resizeObserver = new ResizeObserver(throttledResize);
  resizeObserver.observe(container);

  // Initial display
  updateTabletDisplay();
  updateAreaDisplay();
  updateAreaBDisplay();
}

/**
 * Update tablet dimensions
 */
export function setTablet(width, height) {
  state.tablet.width = width;
  state.tablet.height = height;
  updateTabletDisplay();
  updateAreaDisplay();
}

/**
 * Update area properties
 */
export function setArea(area) {
  state.area = { ...state.area, ...area };
  updateAreaDisplay();
}

/**
 * Update area B properties (comparison mode)
 */
export function setAreaB(area) {
  state.areaB = { ...state.areaB, ...area };
  updateAreaBDisplay();
}

/**
 * Set area radius
 */
export function setAreaRadius(radius) {
  if (state.activeZone === 'A') {
    state.area.radius = radius;
    updateAreaDisplay();
  } else {
    state.areaB.radius = radius;
    updateAreaBDisplay();
  }
}

/**
 * Set area rotation
 */
export function setAreaRotation(rotation) {
  if (state.activeZone === 'A') {
    state.area.rotation = rotation;
    updateAreaDisplay();
  } else {
    state.areaB.rotation = rotation;
    updateAreaBDisplay();
  }
}

/**
 * Enable/disable comparison mode
 */
export function setComparisonMode(enabled) {
  state.comparisonMode = enabled;
  updateAreaDisplay();
  updateAreaBDisplay();
}

/**
 * Set active zone ('A' or 'B')
 */
export function setActiveZone(zone) {
  state.activeZone = zone;
  updateAreaDisplay();
  updateAreaBDisplay();
}

/**
 * Get current active zone
 */
export function getActiveZone() {
  return state.activeZone;
}

/**
 * Toggle grid visibility
 */
export function setGridVisible(visible) {
  state.gridVisible = visible;
  if (gridElement) {
    gridElement.classList.toggle('hidden', !visible);
  }
}

/**
 * Get current state
 */
export function getState() {
  return {
    tablet: { ...state.tablet },
    area: { ...state.area },
    areaB: { ...state.areaB },
    comparisonMode: state.comparisonMode,
    activeZone: state.activeZone,
  };
}

/**
 * Show loading overlay
 */
export function showLoading() {
  const loading = container?.querySelector('#visualizer-loading');
  if (loading) loading.classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const loading = container?.querySelector('#visualizer-loading');
  if (loading) loading.classList.add('hidden');
}
