/**
 * Osu!rea - Main Entry Point
 * Tablet area visualizer for osu!
 *
 * Owns the application state and renders it. Area maths live in
 * controllers/areaController.js; each UI piece lives in its module.
 */

// Agrume kit (copied verbatim, see src/styles/agrume/), then the site's own styles
import './styles/agrume/fonts.css';
import './styles/agrume/tokens.css';
import './styles/agrume/base.css';
import './styles/agrume/components.css';
import './styles/agrume/app.css';
import './styles/osurea.css';

import { initI18n, t } from './modules/i18n.js';
import { icon } from './modules/icons.js';
import { loadPrefs, savePrefs, normalizeArea, normalizeTablet } from './modules/storage.js';
import {
  initVisualizer,
  setTablet,
  setArea,
  setAreaB,
  setGridVisible,
  setComparisonMode,
  setActiveZone,
  openAlignMenu,
  closeAlignMenu,
  isAlignMenuOpen,
  refreshVisualizerLabels,
} from './modules/visualizer.js';
import {
  initTabletSelector,
  setCurrentTablet,
  refreshTabletSelector,
} from './modules/tablet-selector.js';
import { initFavorites, renderFavorites, saveCurrentAsFavorite } from './modules/favorites.js';
import { initProPlayers, openProPlayersModal } from './modules/pro-players.js';
import { showRecapModal } from './modules/modal.js';
import { createHistory, initKeyboardShortcuts } from './modules/history.js';
import {
  debounce,
  getActiveArea,
  formatNumber,
  formatInputNumber,
  calculateRatioString,
  clamp,
} from './modules/utils.js';
import {
  clampAreaPosition,
  centerArea,
  fitAreaToTablet,
  setFullArea,
  updateAreaDimensions,
  updateAreaPosition,
  updateRadius,
  updateRotation,
  applyRatioPreset,
} from './controllers/areaController.js';
import { setupThemeToggle, updateThemeToggle } from './controllers/themeController.js';
import { setupLanguageToggles } from './controllers/languageController.js';
import { DEFAULT_TABLET, INPUT_DEBOUNCE_DELAY, SAVE_DEBOUNCE_DELAY } from './constants/index.js';

// ============================================================================
// STATE
// ============================================================================

/** @type {import('./modules/utils.js').AppState} */
const state = {
  tablet: { ...DEFAULT_TABLET },
  area: normalizeArea({ x: 76, y: 47.5, width: 100, height: 62.5 }),
  areaB: normalizeArea({ x: 76, y: 47.5, width: 100, height: 62.5 }),
  comparisonMode: false,
  activeZone: 'A',
  lockRatio: true,
  showGrid: true,
};

/** One undo history per zone */
const histories = { A: createHistory(), B: createHistory() };

/** Custom tablet bounds, in mm */
const CUSTOM_TABLET_MIN = 10;
const CUSTOM_TABLET_MAX = 1000;

// ============================================================================
// DOM CACHE
// ============================================================================

const $ = selector => document.querySelector(selector);
const DOM = {};

function cacheDOMElements() {
  Object.assign(DOM, {
    widthInput: $('#area-width'),
    heightInput: $('#area-height'),
    posXInput: $('#area-pos-x'),
    posYInput: $('#area-pos-y'),
    radiusSlider: $('#area-radius'),
    radiusInput: $('#radius-value'),
    rotationSlider: $('#area-rotation'),
    rotationInput: $('#rotation-value'),
    customWidth: $('#custom-width'),
    customHeight: $('#custom-height'),
    customDimensions: $('#custom-dimensions'),
    ratioDisplay: $('#ratio-display'),
    areaDisplay: $('#area-display'),
    tabletDimensions: $('#tablet-dimensions'),
    themeBtn: $('#theme-toggle'),
    langButtons: document.querySelectorAll('[data-locale]'),
    lockRatioBtn: $('#lock-ratio'),
    gridBtn: $('#toggle-grid'),
    fullAreaBtn: $('#full-area'),
    alignBtn: $('#align-area'),
    recapBtn: $('#show-recap'),
    saveBtn: $('#save-favorite'),
    proPlayersBtn: $('#pro-players-btn'),
    comparisonToggle: $('#toggle-comparison'),
    zoneSelector: $('#zone-selector'),
    zoneButtons: document.querySelectorAll('#zone-selector [data-zone]'),
    ratioButtons: document.querySelectorAll('[data-ratio]'),
    visualizer: $('#visualizer'),
    tabletSelector: $('#tablet-selector'),
    favorites: $('#favorites'),
  });
}

// ============================================================================
// PERSISTENCE
// ============================================================================

function saveState() {
  savePrefs({
    tablet: state.tablet,
    area: state.area,
    areaB: state.areaB,
    comparisonMode: state.comparisonMode,
    activeZone: state.activeZone,
    lockRatio: state.lockRatio,
    showGrid: state.showGrid,
  });
}

const debouncedSaveState = debounce(saveState, SAVE_DEBOUNCE_DELAY);

function loadState() {
  const prefs = loadPrefs();
  if (prefs.tablet) state.tablet = normalizeTablet(prefs.tablet);
  if (prefs.area) state.area = normalizeArea(prefs.area);
  if (prefs.areaB) state.areaB = normalizeArea(prefs.areaB);
  if (typeof prefs.comparisonMode === 'boolean') state.comparisonMode = prefs.comparisonMode;
  if (prefs.activeZone === 'A' || prefs.activeZone === 'B') state.activeZone = prefs.activeZone;
  if (typeof prefs.lockRatio === 'boolean') state.lockRatio = prefs.lockRatio;
  if (typeof prefs.showGrid === 'boolean') state.showGrid = prefs.showGrid;
  // Zone B is only edited in comparison mode
  if (!state.comparisonMode) state.activeZone = 'A';

  fitAreaToTablet(state, 'A');
  fitAreaToTablet(state, 'B');
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Write a value into a field, unless the user is typing in it
 * @param {HTMLInputElement|null} input
 * @param {string|number} value
 * @param {HTMLElement|null} skip
 */
function setField(input, value, skip) {
  if (input && input !== skip) input.value = String(value);
}

/**
 * @param {HTMLElement|null} [skip] - Field being edited, left untouched
 */
function renderInputs(skip = null) {
  const area = getActiveArea(state);
  setField(DOM.widthInput, formatInputNumber(area.width), skip);
  setField(DOM.heightInput, formatInputNumber(area.height), skip);
  setField(DOM.posXInput, formatInputNumber(area.x), skip);
  setField(DOM.posYInput, formatInputNumber(area.y), skip);
  setField(DOM.radiusSlider, area.radius, skip);
  setField(DOM.radiusInput, area.radius, skip);
  setField(DOM.rotationSlider, area.rotation, skip);
  setField(DOM.rotationInput, area.rotation, skip);
  setField(DOM.customWidth, formatInputNumber(state.tablet.width), skip);
  setField(DOM.customHeight, formatInputNumber(state.tablet.height), skip);
}

function renderReadout() {
  const area = getActiveArea(state);
  const ratio = calculateRatioString(area.width, area.height);
  // Readout: one decimal at most (76 × 47.5); the fields keep the exact values
  const short = value => String(Number(value.toFixed(1)));
  if (DOM.areaDisplay) DOM.areaDisplay.textContent = `${short(area.width)} × ${short(area.height)}`;
  if (DOM.ratioDisplay) DOM.ratioDisplay.textContent = ratio;
  if (DOM.tabletDimensions) {
    DOM.tabletDimensions.textContent = `${short(state.tablet.width)} × ${short(state.tablet.height)}`;
  }
  DOM.ratioButtons.forEach(btn =>
    btn.setAttribute('aria-pressed', String(btn.dataset.ratio === ratio))
  );
}

function renderControls() {
  DOM.comparisonToggle?.setAttribute('aria-pressed', String(state.comparisonMode));
  if (DOM.zoneSelector) DOM.zoneSelector.hidden = !state.comparisonMode;
  DOM.zoneButtons.forEach(btn => {
    const { zone } = btn.dataset;
    btn.setAttribute('aria-pressed', String(zone === state.activeZone));
    btn.querySelector('[data-zone-label]').textContent = t('comparison.zone', { zone });
  });

  if (DOM.lockRatioBtn) {
    DOM.lockRatioBtn.setAttribute('aria-pressed', String(state.lockRatio));
    DOM.lockRatioBtn.innerHTML = icon(state.lockRatio ? 'lock' : 'unlock');
  }
  DOM.gridBtn?.setAttribute('aria-pressed', String(state.showGrid));
  if (DOM.customDimensions) DOM.customDimensions.hidden = !state.tablet.isCustom;
}

function syncVisualizer() {
  setTablet(state.tablet.width, state.tablet.height);
  setArea(state.area);
  setAreaB(state.areaB);
  setComparisonMode(state.comparisonMode);
  setActiveZone(state.activeZone);
  setGridVisible(state.showGrid);
}

/**
 * Render the whole state
 * @param {HTMLElement|null} [skip] - Field being edited
 */
function render(skip = null) {
  syncVisualizer();
  renderInputs(skip);
  renderReadout();
  renderControls();
}

/**
 * Render after a change, record it and save it
 * @param {Object} [options]
 * @param {boolean} [options.history=true] - Record the active area for undo
 * @param {HTMLElement|null} [options.skip=null] - Field being edited
 * @param {boolean} [options.immediate=false] - Save now rather than debounced
 */
function commit({ history = true, skip = null, immediate = false } = {}) {
  render(skip);
  if (history) histories[state.activeZone].push(getActiveArea(state));
  if (immediate) saveState();
  else debouncedSaveState();
}

/** Record both zones (after a change of tablet or configuration) */
function recordBothZones() {
  histories.A.push(state.area);
  histories.B.push(state.areaB);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * @param {HTMLInputElement|null} input
 * @returns {number|null}
 */
function readNumber(input) {
  const value = parseFloat(input?.value ?? '');
  return Number.isFinite(value) ? value : null;
}

/**
 * Width / height edited
 * @param {'width'|'height'} changed
 * @param {boolean} isCommit - change event (blur, Enter) rather than typing
 */
function onDimensionEdit(changed, isCommit) {
  const area = getActiveArea(state);
  const input = changed === 'width' ? DOM.widthInput : DOM.heightInput;
  const value = readNumber(input);
  if (value === null || value <= 0) {
    if (isCommit) render(); // restore the last valid value
    return;
  }
  const width = changed === 'width' ? value : area.width;
  const height = changed === 'height' ? value : area.height;
  updateAreaDimensions(state, width, height, changed);
  commit({ history: isCommit, skip: isCommit ? null : input });
}

/**
 * Centre X / Y edited
 * @param {HTMLInputElement} input
 * @param {boolean} isCommit
 */
function onPositionEdit(input, isCommit) {
  const area = getActiveArea(state);
  const value = readNumber(input);
  if (value === null) {
    if (isCommit) render();
    return;
  }
  const x = input === DOM.posXInput ? value : area.x;
  const y = input === DOM.posYInput ? value : area.y;
  updateAreaPosition(state, x, y);
  commit({ history: isCommit, skip: isCommit ? null : input });
}

function onCustomDimensionsEdit() {
  if (!state.tablet.isCustom) return;
  const width = readNumber(DOM.customWidth) ?? state.tablet.width;
  const height = readNumber(DOM.customHeight) ?? state.tablet.height;
  state.tablet = {
    ...state.tablet,
    width: clamp(width, CUSTOM_TABLET_MIN, CUSTOM_TABLET_MAX),
    height: clamp(height, CUSTOM_TABLET_MIN, CUSTOM_TABLET_MAX),
  };
  fitAreaToTablet(state, 'A');
  fitAreaToTablet(state, 'B');
  setCurrentTablet(state.tablet);
  recordBothZones();
  commit({ history: false, immediate: true });
}

function onVisualizerChange(area, zone, isCommit) {
  Object.assign(zone === 'A' ? state.area : state.areaB, area);
  if (isCommit) commit();
  else render();
}

function onTabletSelected(tablet) {
  const next = normalizeTablet(tablet);
  const resized = next.width !== state.tablet.width || next.height !== state.tablet.height;
  state.tablet = next;
  for (const zone of ['A', 'B']) {
    fitAreaToTablet(state, zone);
    if (resized) centerArea(state, zone);
  }
  recordBothZones();
  commit({ history: false, immediate: true });
}

/**
 * Load a saved or shared configuration into the active zone
 * @param {Object} tablet
 * @param {Object} area
 */
function loadConfiguration(tablet, area) {
  state.tablet = normalizeTablet(tablet);
  Object.assign(getActiveArea(state), normalizeArea(area));
  fitAreaToTablet(state, 'A');
  fitAreaToTablet(state, 'B');
  setCurrentTablet(state.tablet);
  recordBothZones();
  commit({ history: false, immediate: true });
}

function toggleComparisonMode() {
  state.comparisonMode = !state.comparisonMode;
  // Never leave the inputs editing a hidden zone
  if (!state.comparisonMode) state.activeZone = 'A';
  commit({ history: false, immediate: true });
}

function switchActiveZone(zone) {
  if (zone === state.activeZone) return;
  state.activeZone = zone;
  commit({ history: false, immediate: true });
}

function handleUndo() {
  const previous = histories[state.activeZone].undo();
  if (!previous) return;
  Object.assign(getActiveArea(state), previous);
  commit({ history: false, immediate: true });
}

function handleRedo() {
  const next = histories[state.activeZone].redo();
  if (!next) return;
  Object.assign(getActiveArea(state), next);
  commit({ history: false, immediate: true });
}

function showRecap() {
  const { tablet } = state;
  const area = getActiveArea(state);
  const tabletName = tablet.isCustom ? t('tablet.custom') : `${tablet.brand} ${tablet.model}`;
  const data = {
    zone: state.comparisonMode ? state.activeZone : '',
    tablet: `${tabletName} (${formatInputNumber(tablet.width)} × ${formatInputNumber(tablet.height)} mm)`,
    width: formatInputNumber(area.width),
    height: formatInputNumber(area.height),
    ratio: calculateRatioString(area.width, area.height),
    surface: formatNumber(area.width * area.height, 1),
    coverageX: formatNumber((area.width / tablet.width) * 100, 1),
    coverageY: formatNumber((area.height / tablet.height) * 100, 1),
    position: `${formatInputNumber(area.x)}, ${formatInputNumber(area.y)}`,
    radius: area.radius,
    rotation: area.rotation,
  };
  const copyText = [
    'Osu!rea',
    `${t('tablet.title')}: ${data.tablet}`,
    `${t('area.size')}: ${data.width} × ${data.height} mm (${data.ratio})`,
    `${t('area.position')}: ${data.position} mm`,
    `${t('area.rotation')}: ${data.rotation}° · ${t('area.radius')}: ${data.radius} %`,
  ].join('\n');
  showRecapModal(data, copyText);
}

function onLocaleChanged() {
  renderControls();
  renderFavorites();
  refreshTabletSelector();
  refreshVisualizerLabels();
  updateThemeToggle(DOM.themeBtn);
}

// ============================================================================
// CONTROLS SETUP
// ============================================================================

function setupControls() {
  setupThemeToggle(DOM.themeBtn);
  setupLanguageToggles(DOM.langButtons, onLocaleChanged);

  // Width / height: live while typing, committed on change (blur, Enter)
  for (const [input, side] of [
    [DOM.widthInput, 'width'],
    [DOM.heightInput, 'height'],
  ]) {
    input?.addEventListener(
      'input',
      debounce(() => onDimensionEdit(side, false), INPUT_DEBOUNCE_DELAY)
    );
    input?.addEventListener('change', () => onDimensionEdit(side, true));
  }

  // Centre X / Y
  for (const input of [DOM.posXInput, DOM.posYInput]) {
    input?.addEventListener(
      'input',
      debounce(() => onPositionEdit(input, false), INPUT_DEBOUNCE_DELAY)
    );
    input?.addEventListener('change', () => onPositionEdit(input, true));
  }

  // Radius: the slider snaps to 0 / 50 / 100, the number field is exact
  DOM.radiusSlider?.addEventListener('input', () => {
    updateRadius(state, Number(DOM.radiusSlider.value), true);
    commit({ history: false });
  });
  DOM.radiusSlider?.addEventListener('change', () => commit());
  DOM.radiusInput?.addEventListener('change', () => {
    updateRadius(state, readNumber(DOM.radiusInput) ?? getActiveArea(state).radius);
    commit();
  });

  // Rotation: the slider snaps to quarter turns, the number field is exact
  DOM.rotationSlider?.addEventListener('input', () => {
    updateRotation(state, Number(DOM.rotationSlider.value), true);
    commit({ history: false });
  });
  DOM.rotationSlider?.addEventListener('change', () => commit());
  DOM.rotationInput?.addEventListener('change', () => {
    updateRotation(state, readNumber(DOM.rotationInput) ?? getActiveArea(state).rotation);
    commit();
  });

  DOM.lockRatioBtn?.addEventListener('click', () => {
    state.lockRatio = !state.lockRatio;
    renderControls();
    saveState();
  });

  DOM.gridBtn?.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    renderControls();
    setGridVisible(state.showGrid);
    saveState();
  });

  DOM.fullAreaBtn?.addEventListener('click', () => {
    setFullArea(state);
    commit({ immediate: true });
  });

  DOM.ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const [w, h] = btn.dataset.ratio.split(':').map(Number);
      applyRatioPreset(state, w / h);
      commit({ immediate: true });
    });
  });

  DOM.alignBtn?.addEventListener('click', () => {
    if (isAlignMenuOpen()) {
      closeAlignMenu();
      return;
    }
    const rect = DOM.alignBtn.getBoundingClientRect();
    openAlignMenu(rect.left, rect.bottom + 4, DOM.alignBtn);
  });

  DOM.recapBtn?.addEventListener('click', showRecap);
  DOM.saveBtn?.addEventListener('click', () => {
    saveCurrentAsFavorite(state.tablet, { ...getActiveArea(state) });
  });
  DOM.proPlayersBtn?.addEventListener('click', openProPlayersModal);
  DOM.comparisonToggle?.addEventListener('click', toggleComparisonMode);
  DOM.zoneButtons.forEach(btn =>
    btn.addEventListener('click', () => switchActiveZone(btn.dataset.zone))
  );

  DOM.customWidth?.addEventListener('change', onCustomDimensionsEdit);
  DOM.customHeight?.addEventListener('change', onCustomDimensionsEdit);

  // Icons in static buttons
  document.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon);
  });

  initKeyboardShortcuts(handleUndo, handleRedo);

  // Save pending changes when the page is hidden or closed
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState();
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  cacheDOMElements();
  loadState();
  await initI18n();

  if (DOM.visualizer) initVisualizer(DOM.visualizer, onVisualizerChange);

  if (DOM.tabletSelector) {
    // The trigger renders synchronously; the list loads in the background.
    initTabletSelector(DOM.tabletSelector, onTabletSelected);
    setCurrentTablet(state.tablet);
  }

  if (DOM.favorites) {
    initFavorites(DOM.favorites, favorite => loadConfiguration(favorite.tablet, favorite.area));
  }
  initProPlayers(player => loadConfiguration({ ...player.tablet, isCustom: false }, player.area));

  setupControls();
  clampAreaPosition(state, 'A');
  clampAreaPosition(state, 'B');
  render();
  recordBothZones();
}

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
