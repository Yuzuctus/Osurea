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
import './styles/agrume/data.css';
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
import { bindNumberField, parseDecimal } from './modules/number-field.js';
import { debounce, getActiveArea, formatDecimal, calculateRatioString } from './modules/utils.js';
import {
  clampAreaPosition,
  centerArea,
  fitAreaToTablet,
  setFullArea,
  setAreaSide,
  updateAreaPosition,
  updateRadius,
  updateRotation,
  applyRatioPreset,
  swapDimensions,
  getSizeLimits,
  getPositionLimits,
} from './controllers/areaController.js';
import { setupThemeToggle, updateThemeToggle } from './controllers/themeController.js';
import { setupLanguageToggles } from './controllers/languageController.js';
import { DEFAULT_TABLET, SAVE_DEBOUNCE_DELAY } from './constants/index.js';

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
const CUSTOM_TABLET = { min: 10, max: 1000 };

/** Out-of-range state of each field while the user types (id → status) */
const fieldStatus = new Map();

const coarsePointer = window.matchMedia('(pointer: coarse)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
    readout: $('#readout'),
    dragHint: $('#drag-hint'),
    themeBtn: $('#theme-toggle'),
    langButtons: document.querySelectorAll('[data-locale]'),
    lockRatioBtn: $('#lock-ratio'),
    swapBtn: $('#swap-dimensions'),
    gridBtn: $('#toggle-grid'),
    fullAreaBtn: $('#full-area'),
    recapBtn: $('#show-recap'),
    undoBtn: $('#undo'),
    redoBtn: $('#redo'),
    saveBtn: $('#save-favorite'),
    proPlayersBtn: $('#pro-players-btn'),
    comparisonToggle: $('#toggle-comparison'),
    zoneSelector: $('#zone-selector'),
    zoneButtons: document.querySelectorAll('#zone-selector [data-zone]'),
    ratioButtons: document.querySelectorAll('[data-ratio]'),
    ratioCustomToggle: $('#ratio-custom-toggle'),
    ratioCustom: $('#ratio-custom'),
    ratioW: $('#ratio-w'),
    ratioH: $('#ratio-h'),
    ratioApply: $('#ratio-apply'),
    helpButton: $('#help-button'),
    notes: document.querySelectorAll('[data-note]'),
    stage: $('.os-stage'),
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
// NOTES: why a value was adjusted
// ============================================================================

/**
 * Explain an adjustment under the group it happened in
 * @param {'size'|'position'|'shape'|'tablet'} group
 * @param {...string} sentences
 */
function showNote(group, ...sentences) {
  const note = [...DOM.notes].find(el => el.dataset.note === group);
  if (note) note.textContent = sentences.filter(Boolean).join(' ');
}

function clearNotes() {
  DOM.notes.forEach(note => {
    note.textContent = '';
  });
}

/**
 * Explain that a typed value was brought back in range
 * @param {'size'|'position'|'shape'|'tablet'} group
 * @param {string} labelKey - i18n key of the field label
 * @param {number} requested
 * @param {number} applied
 * @param {string} unit
 * @param {string} [reasonKey]
 */
function noteClamped(group, labelKey, requested, applied, unit, reasonKey) {
  if (Math.abs(requested - applied) < 1e-6) return;
  const key = requested > applied ? 'note.max' : 'note.min';
  showNote(
    group,
    t(key, { field: t(labelKey), value: formatDecimal(applied), unit }),
    reasonKey ? t(reasonKey) : ''
  );
}

function noteShrunk(group) {
  const area = getActiveArea(state);
  showNote(
    group,
    t('note.shrunk', { width: formatDecimal(area.width, 1), height: formatDecimal(area.height, 1) })
  );
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
  setField(DOM.widthInput, formatDecimal(area.width), skip);
  setField(DOM.heightInput, formatDecimal(area.height), skip);
  setField(DOM.posXInput, formatDecimal(area.x), skip);
  setField(DOM.posYInput, formatDecimal(area.y), skip);
  setField(DOM.radiusSlider, area.radius, skip);
  setField(DOM.radiusInput, area.radius, skip);
  setField(DOM.rotationSlider, area.rotation, skip);
  setField(DOM.rotationInput, formatDecimal(area.rotation), skip);
  setField(DOM.customWidth, formatDecimal(state.tablet.width), skip);
  setField(DOM.customHeight, formatDecimal(state.tablet.height), skip);
}

/**
 * The allowed range under a field, or the error while the value is out of it
 * @param {HTMLInputElement|null} input
 * @param {{min: number, max: number}} range
 * @param {string} unit
 * @param {'max'|'range'} style - "max 152 mm" or "38 to 114 mm"
 */
function renderHint(input, range, unit, style) {
  if (!input) return;
  const hint = document.getElementById(`${input.id}-hint`);
  if (!hint) return;
  const status = fieldStatus.get(input.id);
  hint.classList.toggle('is-error', Boolean(status));
  if (status) {
    hint.textContent = t(status.kind === 'max' ? 'error.max' : 'error.min', {
      value: formatDecimal(status.bound),
      unit,
    });
    return;
  }
  const min = formatDecimal(range.min, 1);
  const max = formatDecimal(range.max, 1);
  if (min === max) hint.textContent = t('hint.fixed', { value: max, unit });
  else if (style === 'max') hint.textContent = t('hint.max', { value: max, unit });
  else hint.textContent = t('hint.range', { min, max, unit });
}

function renderHints() {
  const size = getSizeLimits(state);
  const pos = getPositionLimits(state);
  renderHint(DOM.widthInput, size.width, 'mm', 'max');
  renderHint(DOM.heightInput, size.height, 'mm', 'max');
  renderHint(DOM.posXInput, pos.x, 'mm', 'range');
  renderHint(DOM.posYInput, pos.y, 'mm', 'range');
  renderHint(DOM.customWidth, CUSTOM_TABLET, 'mm', 'range');
  renderHint(DOM.customHeight, CUSTOM_TABLET, 'mm', 'range');
}

/**
 * One readout cell
 * @param {string} label
 * @param {string} value - Trusted HTML
 * @param {string} [detail]
 */
function readoutItem(label, value, detail = '') {
  return `<div><dt class="ag-kicker">${label}</dt><dd>${value}</dd>${
    detail ? `<dd class="os-readout__detail">${detail}</dd>` : ''
  }</div>`;
}

const mm = (w, h) => `${formatDecimal(w, 1)} × ${formatDecimal(h, 1)} <small>mm</small>`;

function renderReadout() {
  if (!DOM.readout) return;
  const area = getActiveArea(state);

  if (!state.comparisonMode) {
    DOM.readout.innerHTML =
      readoutItem(t('area.size'), mm(area.width, area.height)) +
      readoutItem(t('area.ratio'), calculateRatioString(area.width, area.height)) +
      readoutItem(t('tablet.title'), mm(state.tablet.width, state.tablet.height));
    return;
  }

  // Comparison: both zones and how B differs from A
  const a = state.area;
  const b = state.areaB;
  const dw = b.width - a.width;
  const dh = b.height - a.height;
  const surface = ((b.width * b.height) / (a.width * a.height) - 1) * 100;
  const signed = (value, digits) =>
    `${value > 0 ? '+' : value < 0 ? '−' : '±'}${formatDecimal(Math.abs(value), digits)}`;
  const same = Math.abs(dw) < 0.05 && Math.abs(dh) < 0.05;

  DOM.readout.innerHTML =
    readoutItem(
      t('readout.zone', { zone: 'A' }),
      mm(a.width, a.height),
      calculateRatioString(a.width, a.height)
    ) +
    readoutItem(
      t('readout.zone', { zone: 'B' }),
      mm(b.width, b.height),
      calculateRatioString(b.width, b.height)
    ) +
    readoutItem(
      t('readout.diff'),
      same ? t('readout.same') : t('readout.surface', { value: signed(surface, 1) }),
      same ? '' : `${signed(dw, 1)} × ${signed(dh, 1)} mm`
    );
}

function renderControls() {
  const area = getActiveArea(state);
  const ratio = calculateRatioString(area.width, area.height);
  const customOpen = DOM.ratioCustom ? !DOM.ratioCustom.hidden : false;

  if (DOM.comparisonToggle) DOM.comparisonToggle.checked = state.comparisonMode;
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
  DOM.ratioButtons.forEach(btn =>
    btn.setAttribute('aria-pressed', String(!customOpen && btn.dataset.ratio === ratio))
  );
  DOM.ratioCustomToggle?.setAttribute('aria-pressed', String(customOpen));
  DOM.gridBtn?.setAttribute('aria-pressed', String(state.showGrid));
  if (DOM.customDimensions) DOM.customDimensions.hidden = !state.tablet.isCustom;

  const history = histories[state.activeZone];
  if (DOM.undoBtn) DOM.undoBtn.disabled = !history.canUndo();
  if (DOM.redoBtn) DOM.redoBtn.disabled = !history.canRedo();
}

function renderDragHint() {
  if (DOM.dragHint) {
    DOM.dragHint.textContent = t(coarsePointer.matches ? 'area.dragHintTouch' : 'area.dragHint');
  }
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
  renderHints();
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
  if (history) histories[state.activeZone].push(getActiveArea(state), state.tablet);
  render(skip);
  if (immediate) saveState();
  else debouncedSaveState();
}

/** Record both zones (after a change of tablet or configuration) */
function recordBothZones() {
  histories.A.push(state.area, state.tablet);
  histories.B.push(state.areaB, state.tablet);
}

// ============================================================================
// FIELDS
// ============================================================================

/**
 * Wire one area field
 * @param {HTMLInputElement|null} input
 * @param {Object} config
 */
function bindAreaField(
  input,
  { range, current, set, group, labelKey, unit, reason, step = 1, integer = false, live = true }
) {
  bindNumberField(input, {
    range,
    current,
    step,
    integer,
    live,
    apply: (value, { commit: isCommit, requested }) => {
      clearNotes();
      const reasonKey = reason?.();
      const extra = set(value, isCommit);
      commit({ history: isCommit, skip: isCommit ? null : input });
      if (isCommit) {
        noteClamped(group, labelKey, requested, value, unit, reasonKey);
        if (extra?.shrunk) noteShrunk(group);
      }
    },
    onStatus: status => {
      if (status) fieldStatus.set(input.id, status);
      else fieldStatus.delete(input.id);
      renderHints();
    },
    onUnreadable: text => showNote(group, t('note.unreadable', { text })),
  });
}

function setupFields() {
  const area = () => getActiveArea(state);
  const sizeReason = side => () => `reason.${getSizeLimits(state)[side].reason}`;

  bindAreaField(DOM.widthInput, {
    range: () => getSizeLimits(state).width,
    current: () => area().width,
    set: value => setAreaSide(state, 'width', value),
    group: 'size',
    labelKey: 'area.width',
    unit: 'mm',
    reason: sizeReason('width'),
  });
  bindAreaField(DOM.heightInput, {
    range: () => getSizeLimits(state).height,
    current: () => area().height,
    set: value => setAreaSide(state, 'height', value),
    group: 'size',
    labelKey: 'area.height',
    unit: 'mm',
    reason: sizeReason('height'),
  });
  bindAreaField(DOM.posXInput, {
    range: () => getPositionLimits(state).x,
    current: () => area().x,
    set: value => updateAreaPosition(state, value, area().y),
    group: 'position',
    labelKey: 'area.x',
    unit: 'mm',
    reason: () => 'reason.position',
  });
  bindAreaField(DOM.posYInput, {
    range: () => getPositionLimits(state).y,
    current: () => area().y,
    set: value => updateAreaPosition(state, area().x, value),
    group: 'position',
    labelKey: 'area.y',
    unit: 'mm',
    reason: () => 'reason.position',
  });
  bindAreaField(DOM.radiusInput, {
    range: () => ({ min: 0, max: 100 }),
    current: () => area().radius,
    set: value => updateRadius(state, value),
    group: 'shape',
    labelKey: 'area.radius',
    unit: '%',
    integer: true,
  });
  bindAreaField(DOM.rotationInput, {
    range: () => ({ min: -180, max: 180 }),
    current: () => area().rotation,
    set: value => updateRotation(state, value),
    group: 'shape',
    labelKey: 'area.rotation',
    unit: '°',
    integer: true,
    // A rotation preview while typing could shrink the area: apply on commit
    live: false,
  });

  // Custom tablet: applied on commit only, so typing "150" never passes by "1"
  for (const [input, side] of [
    [DOM.customWidth, 'width'],
    [DOM.customHeight, 'height'],
  ]) {
    bindNumberField(input, {
      range: () => CUSTOM_TABLET,
      current: () => state.tablet[side],
      live: false,
      apply: (value, { requested }) => {
        clearNotes();
        onCustomDimensionsEdit(side, value);
        noteClamped('tablet', `area.${side}`, requested, value, 'mm', 'reason.custom');
      },
      onStatus: status => {
        if (status) fieldStatus.set(input.id, status);
        else fieldStatus.delete(input.id);
        renderHints();
      },
      onUnreadable: text => showNote('tablet', t('note.unreadable', { text })),
    });
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onCustomDimensionsEdit(side, value) {
  if (!state.tablet.isCustom) return;
  state.tablet = { ...state.tablet, [side]: value };
  const shrunkA = fitAreaToTablet(state, 'A');
  const shrunkB = fitAreaToTablet(state, 'B');
  setCurrentTablet(state.tablet);
  recordBothZones();
  commit({ history: false, immediate: true });
  if (shrunkA || shrunkB) noteShrunk('tablet');
}

function onVisualizerChange(area, zone, isCommit) {
  Object.assign(zone === 'A' ? state.area : state.areaB, area);
  if (isCommit) {
    clearNotes();
    commit();
  } else render();
}

function onTabletSelected(tablet) {
  const next = normalizeTablet(tablet);
  const resized = next.width !== state.tablet.width || next.height !== state.tablet.height;
  state.tablet = next;
  for (const zone of ['A', 'B']) {
    fitAreaToTablet(state, zone);
    if (resized) centerArea(state, zone);
  }
  clearNotes();
  recordBothZones();
  commit({ history: false, immediate: true });
}

/**
 * Bring the preview into view when it is off screen (after loading from the
 * favorites list or a dialog, far below or above it)
 */
function revealStage() {
  const rect = DOM.stage?.getBoundingClientRect();
  if (!rect || (rect.top >= 0 && rect.top < window.innerHeight * 0.5)) return;
  DOM.stage.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Load a saved or shared configuration into the active zone
 * @param {Object} tablet
 * @param {Object} area
 * @param {string} name
 */
function loadConfiguration(tablet, area, name) {
  state.tablet = normalizeTablet(tablet);
  Object.assign(getActiveArea(state), normalizeArea(area));
  fitAreaToTablet(state, 'A');
  fitAreaToTablet(state, 'B');
  setCurrentTablet(state.tablet);
  clearNotes();
  recordBothZones();
  commit({ history: false, immediate: true });
  showNote('size', t('note.loaded', { name, zone: state.activeZone }));
  revealStage();
}

function toggleComparisonMode() {
  state.comparisonMode = !state.comparisonMode;
  // Never leave the inputs editing a hidden zone
  if (!state.comparisonMode) state.activeZone = 'A';
  clearNotes();
  commit({ history: false, immediate: true });
}

function switchActiveZone(zone) {
  if (zone === state.activeZone) return;
  state.activeZone = zone;
  clearNotes();
  fieldStatus.clear();
  commit({ history: false, immediate: true });
}

/**
 * Restore a history entry: the area, and its tablet when it changed since.
 * The other zone is fitted to that tablet, so nothing is left outside it.
 * @param {Object|null} entry
 */
function restoreEntry(entry) {
  if (!entry) return;
  const { tablet, ...area } = entry;
  if (tablet && JSON.stringify(tablet) !== JSON.stringify(state.tablet)) {
    state.tablet = normalizeTablet(tablet);
    setCurrentTablet(state.tablet);
  }
  Object.assign(getActiveArea(state), area);
  fitAreaToTablet(state, 'A');
  fitAreaToTablet(state, 'B');
  clearNotes();
  commit({ history: false, immediate: true });
}

function handleUndo() {
  restoreEntry(histories[state.activeZone].undo());
}

function handleRedo() {
  restoreEntry(histories[state.activeZone].redo());
}

/** Fill the custom ratio fields with the current ratio */
function fillCustomRatio() {
  const area = getActiveArea(state);
  const [w, h] = calculateRatioString(area.width, area.height).split(':');
  if (DOM.ratioW) DOM.ratioW.value = w;
  if (DOM.ratioH) DOM.ratioH.value = h;
}

function applyCustomRatio() {
  const w = parseDecimal(DOM.ratioW?.value);
  const h = parseDecimal(DOM.ratioH?.value);
  clearNotes();
  if (!(w > 0) || !(h > 0)) {
    showNote('size', t('note.ratioInvalid'));
    return;
  }
  const shrunk = applyRatioPreset(state, w / h);
  commit({ immediate: true });
  if (shrunk) noteShrunk('size');
}

function showRecap() {
  const { tablet } = state;
  const area = getActiveArea(state);
  const tabletName = tablet.isCustom ? t('tablet.custom') : `${tablet.brand} ${tablet.model}`;
  const data = {
    zone: state.comparisonMode ? state.activeZone : '',
    tablet: `${tabletName} (${formatDecimal(tablet.width)} × ${formatDecimal(tablet.height)} mm)`,
    width: formatDecimal(area.width),
    height: formatDecimal(area.height),
    ratio: calculateRatioString(area.width, area.height),
    surface: formatDecimal(area.width * area.height, 1),
    coverageX: formatDecimal((area.width / tablet.width) * 100, 1),
    coverageY: formatDecimal((area.height / tablet.height) * 100, 1),
    position: `X ${formatDecimal(area.x)} · Y ${formatDecimal(area.y)}`,
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
  clearNotes();
  render();
  renderDragHint();
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
  setupFields();

  // Sliders: they snap (radius 0 / 50 / 100, rotation by quarter turns).
  // Notes change only when a gesture starts or ends: a note appearing while
  // the thumb is dragged makes the browser drop the drag.
  for (const slider of [DOM.radiusSlider, DOM.rotationSlider]) {
    slider?.addEventListener('pointerdown', clearNotes);
    slider?.addEventListener('keydown', clearNotes);
  }
  DOM.radiusSlider?.addEventListener('input', () => {
    updateRadius(state, Number(DOM.radiusSlider.value), true);
    commit({ history: false });
  });
  DOM.radiusSlider?.addEventListener('change', () => commit());

  // Rotation: every angle of a gesture starts from the size the area had
  // before it, so trying 45° then coming back to 0° gives the size back.
  let rotationGesture = null;
  DOM.rotationSlider?.addEventListener('input', () => {
    const area = getActiveArea(state);
    const g = rotationGesture;
    if (!g || g.zone !== state.activeZone || g.width !== area.width || g.height !== area.height) {
      rotationGesture = {
        zone: state.activeZone,
        base: { width: area.width, height: area.height, x: area.x, y: area.y },
      };
    }
    Object.assign(area, rotationGesture.base);
    const { shrunk } = updateRotation(state, Number(DOM.rotationSlider.value), true);
    Object.assign(rotationGesture, { width: area.width, height: area.height, shrunk });
    commit({ history: false });
  });
  DOM.rotationSlider?.addEventListener('change', () => {
    commit();
    if (rotationGesture?.shrunk) noteShrunk('shape');
  });
  DOM.rotationSlider?.addEventListener('blur', () => {
    rotationGesture = null;
  });

  DOM.lockRatioBtn?.addEventListener('click', () => {
    state.lockRatio = !state.lockRatio;
    fieldStatus.clear();
    render();
    saveState();
  });

  DOM.swapBtn?.addEventListener('click', () => {
    clearNotes();
    const shrunk = swapDimensions(state);
    commit({ immediate: true });
    if (shrunk) noteShrunk('size');
  });

  DOM.gridBtn?.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    renderControls();
    setGridVisible(state.showGrid);
    saveState();
  });

  DOM.fullAreaBtn?.addEventListener('click', () => {
    clearNotes();
    setFullArea(state);
    commit({ immediate: true });
  });

  DOM.ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const [w, h] = btn.dataset.ratio.split(':').map(Number);
      clearNotes();
      if (DOM.ratioCustom) DOM.ratioCustom.hidden = true;
      DOM.ratioCustomToggle?.setAttribute('aria-expanded', 'false');
      const shrunk = applyRatioPreset(state, w / h);
      commit({ immediate: true });
      if (shrunk) noteShrunk('size');
    });
  });

  DOM.ratioCustomToggle?.addEventListener('click', () => {
    const open = DOM.ratioCustom.hidden;
    DOM.ratioCustom.hidden = !open;
    DOM.ratioCustomToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      fillCustomRatio();
      DOM.ratioW?.focus();
    }
    renderControls();
  });
  DOM.ratioApply?.addEventListener('click', applyCustomRatio);
  for (const input of [DOM.ratioW, DOM.ratioH]) {
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomRatio();
      }
    });
    input?.addEventListener('focus', () => input.select());
  }

  // Help: a small "i" opens the gestures and keys, one tap away
  const closeHelp = () => {
    if (DOM.dragHint) DOM.dragHint.hidden = true;
    DOM.helpButton?.setAttribute('aria-expanded', 'false');
  };
  DOM.helpButton?.addEventListener('click', () => {
    const open = DOM.dragHint.hidden;
    DOM.dragHint.hidden = !open;
    DOM.helpButton.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.os-help')) closeHelp();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && DOM.dragHint && !DOM.dragHint.hidden) {
      closeHelp();
      DOM.helpButton?.focus();
    }
  });

  DOM.undoBtn?.addEventListener('click', handleUndo);
  DOM.redoBtn?.addEventListener('click', handleRedo);
  DOM.recapBtn?.addEventListener('click', showRecap);
  DOM.saveBtn?.addEventListener('click', () => {
    saveCurrentAsFavorite(
      state.tablet,
      { ...getActiveArea(state) },
      state.comparisonMode ? state.activeZone : ''
    );
  });
  DOM.proPlayersBtn?.addEventListener('click', openProPlayersModal);
  DOM.comparisonToggle?.addEventListener('change', toggleComparisonMode);
  DOM.zoneButtons.forEach(btn =>
    btn.addEventListener('click', () => switchActiveZone(btn.dataset.zone))
  );

  // Icons in static buttons
  document.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon);
  });

  initKeyboardShortcuts(handleUndo, handleRedo);
  coarsePointer.addEventListener('change', renderDragHint);

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
    initFavorites(DOM.favorites, favorite =>
      loadConfiguration(favorite.tablet, favorite.area, favorite.name)
    );
  }
  initProPlayers(player =>
    loadConfiguration({ ...player.tablet, isCustom: false }, player.area, player.name.trim())
  );

  setupControls();
  clampAreaPosition(state, 'A');
  clampAreaPosition(state, 'B');
  recordBothZones();
  render();
  renderDragHint();
}

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
