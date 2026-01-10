/**
 * Osu!rea - Controls Setup
 * Centralized event listener setup for all UI controls
 * @module controllers/controlsSetup
 */

import { icon } from '../modules/icons.js';
import { debounce, getActiveArea } from '../modules/utils.js';
import { INPUT_DEBOUNCE_DELAY, DEFAULT_TABLET } from '../constants/index.js';
import { setGridVisible } from '../modules/visualizer.js';
import { openProPlayersModal } from '../modules/pro-players.js';

/**
 * Setup area dimension inputs (width/height)
 * @param {Object} DOM - DOM element cache
 * @param {Function} onInputChange - Called on debounced input (forceUpdate=false)
 * @param {Function} onInputCommit - Called on blur/change (forceUpdate=true)
 */
export function setupAreaDimensionInputs(DOM, onInputChange, onInputCommit) {
  const debouncedChange = debounce(() => onInputChange(false), INPUT_DEBOUNCE_DELAY);

  DOM.widthInput?.addEventListener('input', debouncedChange);
  DOM.heightInput?.addEventListener('input', debouncedChange);
  DOM.widthInput?.addEventListener('change', () => onInputCommit(true));
  DOM.heightInput?.addEventListener('change', () => onInputCommit(true));
}

/**
 * Setup position inputs (X/Y)
 * @param {Object} DOM - DOM element cache
 * @param {Function} onInputChange - Called on debounced input
 * @param {Function} onInputCommit - Called on blur/change
 */
export function setupPositionInputs(DOM, onInputChange, onInputCommit) {
  const debouncedChange = debounce(() => onInputChange(false), INPUT_DEBOUNCE_DELAY);

  DOM.posXInput?.addEventListener('input', debouncedChange);
  DOM.posYInput?.addEventListener('input', debouncedChange);
  DOM.posXInput?.addEventListener('change', () => onInputCommit(true));
  DOM.posYInput?.addEventListener('change', () => onInputCommit(true));
}

/**
 * Setup radius slider and input
 * @param {Object} DOM - DOM element cache
 * @param {Function} onSliderChange - Called when slider moves (with snap)
 * @param {Function} onInputChange - Called when input value changes (no snap)
 */
export function setupRadiusControls(DOM, onSliderChange, onInputChange) {
  DOM.radiusSlider?.addEventListener('input', onSliderChange);
  DOM.radiusInput?.addEventListener('change', onInputChange);
}

/**
 * Setup rotation slider and input
 * @param {Object} DOM - DOM element cache
 * @param {Function} onSliderChange - Called when slider moves (with snap)
 * @param {Function} onInputChange - Called when input value changes (no snap)
 */
export function setupRotationControls(DOM, onSliderChange, onInputChange) {
  DOM.rotationSlider?.addEventListener('input', onSliderChange);
  DOM.rotationInput?.addEventListener('change', onInputChange);
}

/**
 * Setup lock ratio toggle button
 * @param {Object} DOM - DOM element cache
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {Function} onToggle - Called when toggled with new lock state
 */
export function setupLockRatioToggle(DOM, state, onToggle) {
  if (!DOM.lockRatioBtn) return;

  // Set initial state
  DOM.lockRatioBtn.classList.toggle('active', state.lockRatio);
  DOM.lockRatioBtn.innerHTML = icon(state.lockRatio ? 'lock' : 'unlock');

  DOM.lockRatioBtn.addEventListener('click', () => {
    state.lockRatio = !state.lockRatio;
    DOM.lockRatioBtn.classList.toggle('active', state.lockRatio);
    DOM.lockRatioBtn.innerHTML = icon(state.lockRatio ? 'lock' : 'unlock');

    if (state.lockRatio) {
      // Capture current ratio when lock is enabled
      const activeArea = getActiveArea(state);
      const currentRatio = activeArea.width / activeArea.height;
      if (state.activeZone === 'A') {
        state.lockedRatio = currentRatio;
      } else {
        state.lockedRatioB = currentRatio;
      }
    }

    onToggle(state.lockRatio);
  });
}

/**
 * Setup grid toggle button
 * @param {Object} DOM - DOM element cache
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {Function} onToggle - Called when toggled
 */
export function setupGridToggle(DOM, state, onToggle) {
  if (!DOM.gridBtn || !DOM.gridIcon) return;

  DOM.gridBtn.classList.toggle('active', state.showGrid);
  DOM.gridIcon.innerHTML = icon('grid');

  DOM.gridBtn.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    DOM.gridBtn.classList.toggle('active', state.showGrid);
    setGridVisible(state.showGrid);
    onToggle(state.showGrid);
  });
}

/**
 * Setup toolbar action buttons (full area, recap, save, pro players, comparison)
 * @param {Object} DOM - DOM element cache
 * @param {Object} handlers - Event handlers
 */
export function setupToolbarButtons(DOM, handlers) {
  // Full area button
  if (DOM.fullAreaBtn && DOM.fullAreaIcon) {
    DOM.fullAreaIcon.innerHTML = icon('crop');
    DOM.fullAreaBtn.addEventListener('click', handlers.onFullArea);
  }

  // Recap button
  if (DOM.recapBtn && DOM.recapIcon) {
    DOM.recapIcon.innerHTML = icon('info');
    DOM.recapBtn.addEventListener('click', handlers.onRecap);
  }

  // Save favorite button
  if (DOM.saveIcon) {
    DOM.saveIcon.innerHTML = icon('heart');
  }
  DOM.saveBtn?.addEventListener('click', handlers.onSaveFavorite);

  // Pro players button
  if (DOM.proPlayersIcon) {
    DOM.proPlayersIcon.innerHTML = icon('users');
  }
  DOM.proPlayersBtn?.addEventListener('click', openProPlayersModal);

  // Comparison mode toggle
  if (DOM.comparisonIcon) {
    DOM.comparisonIcon.innerHTML = icon('layers');
  }
  DOM.comparisonToggle?.addEventListener('click', handlers.onToggleComparison);
}

/**
 * Setup zone selector buttons (A/B)
 * @param {Object} DOM - DOM element cache
 * @param {Function} onZoneSwitch - Called with zone ('A' or 'B')
 */
export function setupZoneSelector(DOM, onZoneSwitch) {
  DOM.zoneABtn?.addEventListener('click', () => onZoneSwitch('A'));
  DOM.zoneBBtn?.addEventListener('click', () => onZoneSwitch('B'));
}

/**
 * Setup custom tablet dimensions inputs
 * @param {Object} DOM - DOM element cache
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {Function} onDimensionsChange - Called with (width, height)
 */
export function setupCustomDimensions(DOM, state, onDimensionsChange) {
  const updateCustomDimensions = () => {
    if (state.tablet?.isCustom) {
      const w = parseFloat(DOM.customWidth?.value) || DEFAULT_TABLET.width;
      const h = parseFloat(DOM.customHeight?.value) || DEFAULT_TABLET.height;
      onDimensionsChange(w, h);
    }
  };

  DOM.customWidth?.addEventListener('change', updateCustomDimensions);
  DOM.customHeight?.addEventListener('change', updateCustomDimensions);
}

/**
 * Setup ratio preset buttons
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {Function} onPresetSelect - Called with target ratio
 */
export function setupRatioPresets(state, onPresetSelect) {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.tablet) return;

      const ratioStr = btn.dataset.ratio;
      const [ratioW, ratioH] = ratioStr.split(':').map(Number);
      const targetRatio = ratioW / ratioH;

      // Update active state
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      onPresetSelect(targetRatio);
    });
  });
}

/**
 * Setup visualizer area change event listener
 * @param {import('../modules/utils.js').AppState} state - App state
 * @param {Function} onAreaChanged - Called after area state is updated
 */
export function setupAreaChangeListener(state, onAreaChanged) {
  window.addEventListener('area-changed', e => {
    const zone = e.detail.zone || 'A';
    if (zone === 'A') {
      Object.assign(state.area, e.detail);
    } else {
      Object.assign(state.areaB, e.detail);
    }
    onAreaChanged();
  });
}
