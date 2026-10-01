/**
 * Osu!rea - Visualizer Module
 * Draws the tablet and its active area(s) with DOM elements.
 * Pointer events cover mouse, pen and touch; the area also moves with the
 * arrow keys once focused.
 * @module visualizer
 */

import { icon } from './icons.js';
import { t } from './i18n.js';
import { clamp, clampCentre, getHalfExtents, formatDecimal } from './utils.js';
import {
  MAX_VISUALIZER_SCALE,
  VISUALIZER_PADDING,
  GRID_STEP_MM,
  KEYBOARD_STEP_MM,
} from '../constants/index.js';

/** Alignment positions, in reading order (3 × 3 grid). */
export const ALIGN_POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

const ALIGN_ICONS = {
  'top-left': 'alignTopLeft',
  top: 'alignTop',
  'top-right': 'alignTopRight',
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
  'bottom-left': 'alignBottomLeft',
  bottom: 'alignBottom',
  'bottom-right': 'alignBottomRight',
};

// DOM element references
let container = null;
let tabletBoundary = null;
/** @type {{A: HTMLElement|null, B: HTMLElement|null}} */
const areaEls = { A: null, B: null };
let alignMenu = null;
let alignReturnFocus = null;

const state = {
  tablet: { width: 152, height: 95 },
  areas: {
    A: { width: 76, height: 47.5, x: 76, y: 47.5, radius: 0, rotation: 0 },
    B: { width: 76, height: 47.5, x: 76, y: 47.5, radius: 0, rotation: 0 },
  },
  comparisonMode: false,
  activeZone: 'A',
  scale: 1,
  gridVisible: true,
  drag: null,
};

/**
 * Called when the user moves the area in the visualizer.
 * @type {((area: Object, zone: 'A'|'B', commit: boolean) => void)|null}
 */
let onAreaChange = null;

/**
 * Calculate scale to fit tablet in container
 * @returns {number} - Pixels per millimetre
 */
function calculateScale() {
  if (!container || !state.tablet.width || !state.tablet.height) return 1;
  const availableWidth = container.clientWidth - VISUALIZER_PADDING * 2;
  const availableHeight = container.clientHeight - VISUALIZER_PADDING * 2;
  const scale = Math.min(
    availableWidth / state.tablet.width,
    availableHeight / state.tablet.height,
    MAX_VISUALIZER_SCALE
  );
  return Math.max(scale, 0.1);
}

/**
 * Update tablet boundary display
 */
function renderTablet() {
  if (!tabletBoundary) return;
  // The preview box takes the tablet's proportions (see .os-visualizer)
  const ratio = `${state.tablet.width} / ${state.tablet.height}`;
  if (container.style.getPropertyValue('--os-tablet-ratio') !== ratio) {
    container.style.setProperty('--os-tablet-ratio', ratio);
  }
  state.scale = calculateScale();
  tabletBoundary.style.width = `${state.tablet.width * state.scale}px`;
  tabletBoundary.style.height = `${state.tablet.height * state.scale}px`;
  tabletBoundary.style.setProperty('--os-grid-step', `${GRID_STEP_MM * state.scale}px`);
  tabletBoundary.dataset.grid = String(state.gridVisible);
}

/**
 * Render one zone
 * @param {'A'|'B'} zone
 */
function renderArea(zone) {
  const el = areaEls[zone];
  if (!el) return;

  const visible = zone === 'A' || state.comparisonMode;
  el.hidden = !visible;
  if (!visible) return;

  const { width, height, x, y, radius, rotation } = state.areas[zone];
  const { scale } = state;

  el.style.width = `${width * scale}px`;
  el.style.height = `${height * scale}px`;
  el.style.left = `${(x - width / 2) * scale}px`;
  el.style.top = `${(y - height / 2) * scale}px`;
  // 100 % radius = half of the smallest side
  el.style.borderRadius = `${((radius || 0) / 100) * (Math.min(width, height) / 2) * scale}px`;
  el.style.transform = `rotate(${rotation || 0}deg)`;

  const inactive = state.comparisonMode && state.activeZone !== zone;
  el.classList.toggle('is-inactive', inactive);
  el.tabIndex = inactive ? -1 : 0;

  const label = el.querySelector('.os-area__label');
  if (label) label.hidden = !state.comparisonMode;

  el.setAttribute(
    'aria-label',
    t('area.label', {
      zone,
      width: formatDecimal(width, 1),
      height: formatDecimal(height, 1),
      x: formatDecimal(x, 1),
      y: formatDecimal(y, 1),
    })
  );
}

function renderAll() {
  renderTablet();
  renderArea('A');
  renderArea('B');
}

/**
 * Clamp a centre position so the area, rotation included, stays on the tablet
 * @param {Object} area
 * @param {number} x
 * @param {number} y
 * @returns {{x: number, y: number}}
 */
function clampToTablet(area, x, y) {
  return clampCentre(area, state.tablet, x, y);
}

/**
 * Move the active zone and notify
 * @param {number} x
 * @param {number} y
 * @param {boolean} commit - true when the gesture is over
 */
function moveActive(x, y, commit) {
  const zone = state.activeZone;
  const area = state.areas[zone];
  const pos = clampToTablet(area, x, y);
  area.x = pos.x;
  area.y = pos.y;
  renderArea(zone);
  onAreaChange?.({ ...area }, zone, commit);
}

// ------------------------------------------------------------ pointer drag

function handlePointerDown(e, zone) {
  if (zone !== state.activeZone) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  e.preventDefault();
  const el = areaEls[zone];
  const tabletRect = tabletBoundary.getBoundingClientRect();
  const area = state.areas[zone];

  // Offset between the pointer and the area centre, in millimetres
  state.drag = {
    pointerId: e.pointerId,
    offsetX: (e.clientX - tabletRect.left) / state.scale - area.x,
    offsetY: (e.clientY - tabletRect.top) / state.scale - area.y,
    moved: false,
  };
  el.setPointerCapture(e.pointerId);
  el.classList.add('is-dragging');
  el.focus({ preventScroll: true });
}

function handlePointerMove(e) {
  const { drag } = state;
  if (!drag || e.pointerId !== drag.pointerId) return;
  const tabletRect = tabletBoundary.getBoundingClientRect();
  const x = (e.clientX - tabletRect.left) / state.scale - drag.offsetX;
  const y = (e.clientY - tabletRect.top) / state.scale - drag.offsetY;
  drag.moved = true;
  moveActive(x, y, false);
}

function handlePointerUp(e) {
  const { drag } = state;
  if (!drag || e.pointerId !== drag.pointerId) return;
  const el = areaEls[state.activeZone];
  el.classList.remove('is-dragging');
  if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  state.drag = null;
  if (drag.moved) {
    const area = state.areas[state.activeZone];
    onAreaChange?.({ ...area }, state.activeZone, true);
  }
}

// --------------------------------------------------------------- keyboard

function handleKeydown(e, zone) {
  if (zone !== state.activeZone) return;
  const step = KEYBOARD_STEP_MM * (e.shiftKey ? 10 : 1);
  const moves = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = moves[e.key];
  if (!move) return;
  e.preventDefault();
  const area = state.areas[zone];
  moveActive(area.x + move[0], area.y + move[1], true);
}

// ------------------------------------------------------------- align menu

/**
 * Align the active area to a position on the tablet
 * @param {string} position - One of ALIGN_POSITIONS
 */
export function alignArea(position) {
  const area = state.areas[state.activeZone];
  const { halfW, halfH } = getHalfExtents(area);
  const { width: tw, height: th } = state.tablet;

  const col = position.includes('left') ? halfW : position.includes('right') ? tw - halfW : tw / 2;
  const row = position.includes('top') ? halfH : position.includes('bottom') ? th - halfH : th / 2;
  moveActive(col, row, true);
}

function createAlignMenu() {
  const menu = document.createElement('div');
  menu.className = 'os-align';
  menu.id = 'align-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-labelledby', 'align-menu-title');
  document.body.appendChild(menu);

  menu.addEventListener('click', e => {
    const btn = e.target.closest('[data-align]');
    if (!btn) return;
    alignArea(btn.dataset.align);
    closeAlignMenu();
  });
  menu.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeAlignMenu();
    }
  });
  // Focus landing anywhere else in the page (Tab, click) closes it
  document.addEventListener('focusin', e => {
    if (!menu.hidden && !menu.contains(e.target)) {
      menu.hidden = true;
      alignReturnFocus?.setAttribute('aria-expanded', 'false');
      alignReturnFocus = null;
    }
  });
  return menu;
}

function renderAlignMenu() {
  alignMenu.innerHTML = `
    <p class="ag-kicker" id="align-menu-title">${t('alignment.title')}</p>
    <div class="os-align__grid">
      ${ALIGN_POSITIONS.map(
        pos => `<button class="ag-button ag-button--quiet" type="button" data-align="${pos}"
          aria-label="${t(`alignment.${pos}`)}" title="${t(`alignment.${pos}`)}">${icon(ALIGN_ICONS[pos])}</button>`
      ).join('')}
    </div>
  `;
}

/**
 * Open the align menu at a viewport position
 * @param {number} x
 * @param {number} y
 * @param {HTMLElement|null} [returnFocus] - Element to focus on close
 */
export function openAlignMenu(x, y, returnFocus = null) {
  if (!alignMenu) return;
  renderAlignMenu();
  alignMenu.hidden = false;
  alignReturnFocus = returnFocus;

  const rect = alignMenu.getBoundingClientRect();
  const left = clamp(x, 8, window.innerWidth - rect.width - 8);
  const top = clamp(y, 8, window.innerHeight - rect.height - 8);
  alignMenu.style.left = `${left}px`;
  alignMenu.style.top = `${top}px`;
  alignMenu.querySelector('[data-align="center"]')?.focus();
  alignReturnFocus?.setAttribute('aria-expanded', 'true');
}

export function closeAlignMenu() {
  if (!alignMenu || alignMenu.hidden) return;
  alignMenu.hidden = true;
  alignReturnFocus?.setAttribute('aria-expanded', 'false');
  alignReturnFocus?.focus();
  alignReturnFocus = null;
}

export function isAlignMenuOpen() {
  return Boolean(alignMenu && !alignMenu.hidden);
}

// ------------------------------------------------------------------- init

/**
 * Initialize visualizer
 * @param {HTMLElement} containerEl - Container element
 * @param {Function} [onChange] - (area, zone, commit) when the user moves an area
 */
export function initVisualizer(containerEl, onChange = null) {
  container = containerEl;
  onAreaChange = onChange;

  container.innerHTML = `
    <div class="os-tablet-boundary" id="tablet-boundary">
      <div class="os-area" data-zone="A" role="group" aria-describedby="drag-hint"><span class="os-area__label" aria-hidden="true">A</span></div>
      <div class="os-area" data-zone="B" role="group" aria-describedby="drag-hint" hidden><span class="os-area__label" aria-hidden="true">B</span></div>
    </div>
  `;

  tabletBoundary = container.querySelector('#tablet-boundary');
  areaEls.A = container.querySelector('[data-zone="A"]');
  areaEls.B = container.querySelector('[data-zone="B"]');

  for (const zone of ['A', 'B']) {
    const el = areaEls[zone];
    el.addEventListener('pointerdown', e => handlePointerDown(e, zone));
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);
    el.addEventListener('keydown', e => handleKeydown(e, zone));
  }

  alignMenu = createAlignMenu();
  container.addEventListener('contextmenu', e => {
    e.preventDefault();
    openAlignMenu(e.clientX, e.clientY, areaEls[state.activeZone]);
  });
  document.addEventListener('pointerdown', e => {
    if (isAlignMenuOpen() && !alignMenu.contains(e.target) && !e.target.closest('#align-area')) {
      alignMenu.hidden = true;
      alignReturnFocus?.setAttribute('aria-expanded', 'false');
      alignReturnFocus = null;
    }
  });

  let frame = 0;
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(renderAll);
  });
  resizeObserver.observe(container);

  renderAll();
}

/**
 * Update tablet dimensions
 */
export function setTablet(width, height) {
  state.tablet.width = width;
  state.tablet.height = height;
  renderAll();
}

/**
 * Update zone A
 */
export function setArea(area) {
  Object.assign(state.areas.A, area);
  renderArea('A');
}

/**
 * Update zone B (comparison mode)
 */
export function setAreaB(area) {
  Object.assign(state.areas.B, area);
  renderArea('B');
}

/**
 * Enable/disable comparison mode
 */
export function setComparisonMode(enabled) {
  state.comparisonMode = enabled;
  renderArea('A');
  renderArea('B');
}

/**
 * Set active zone ('A' or 'B')
 */
export function setActiveZone(zone) {
  state.activeZone = zone;
  renderArea('A');
  renderArea('B');
}

/**
 * Toggle grid visibility
 */
export function setGridVisible(visible) {
  state.gridVisible = visible;
  renderTablet();
}

/**
 * Re-render labels after a language change
 */
export function refreshVisualizerLabels() {
  renderArea('A');
  renderArea('B');
  if (isAlignMenuOpen()) renderAlignMenu();
}
