/**
 * Osu!rea - Main Entry Point
 * Tablet area visualizer for osu!
 * 
 * This file orchestrates app initialization and wires together all modules.
 * Business logic is delegated to controllers.
 */

import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';

// Modules
import { initI18n, translatePage } from './modules/i18n.js';
import { loadPrefs, savePrefs } from './modules/storage.js';
import {
  initVisualizer,
  setTablet,
  setArea,
  setAreaB,
  setAreaRadius,
  setAreaRotation,
  setGridVisible,
  setComparisonMode,
  setActiveZone,
} from './modules/visualizer.js';
import { initTabletSelector, setCurrentTablet } from './modules/tablet-selector.js';
import { initFavorites, saveCurrentAsFavorite } from './modules/favorites.js';
import { initProPlayers } from './modules/pro-players.js';
import { debounce, getActiveArea, syncActiveArea, formatNumber, calculateRatioString } from './modules/utils.js';
import { showRecapModal } from './modules/modal.js';
import {
  pushState as historyPushState,
  undo as historyUndo,
  redo as historyRedo,
  initKeyboardShortcuts,
} from './modules/history.js';

// Controllers
import {
  initTheme,
  setupThemeToggle,
  setupLanguageDropdown,
  updateLangDisplay,
  clampAreaPosition,
  centerArea,
  setFullArea,
  updateAreaDimensions,
  updateAreaPosition,
  updateRadius,
  updateRotation,
  applyRatioPreset,
  setupAreaDimensionInputs,
  setupPositionInputs,
  setupRadiusControls,
  setupRotationControls,
  setupLockRatioToggle,
  setupGridToggle,
  setupToolbarButtons,
  setupZoneSelector,
  setupCustomDimensions,
  setupRatioPresets,
  setupAreaChangeListener,
} from './controllers/index.js';

import { SAVE_DEBOUNCE_DELAY } from './constants/index.js';

// ============================================================================
// STATE
// ============================================================================

/**
 * Application state
 * @type {import('./modules/utils.js').AppState}
 */
const state = {
  tablet: null,
  area: { x: 0, y: 0, width: 100, height: 62.5, radius: 0, rotation: 0 },
  areaB: { x: 76, y: 47.5, width: 100, height: 62.5, radius: 0, rotation: 0 },
  comparisonMode: false,
  activeZone: 'A',
  lockRatio: true,
  lockedRatio: 16 / 9,
  lockedRatioB: 16 / 9,
  showGrid: true,
};

// ============================================================================
// DOM CACHE
// ============================================================================

/**
 * Cached DOM element references
 * @type {Object.<string, HTMLElement|null>}
 */
const DOM = {};

/**
 * Cache all DOM elements
 */
function cacheDOMElements() {
  // Inputs
  DOM.widthInput = document.querySelector('#area-width');
  DOM.heightInput = document.querySelector('#area-height');
  DOM.posXInput = document.querySelector('#area-pos-x');
  DOM.posYInput = document.querySelector('#area-pos-y');
  DOM.radiusSlider = document.querySelector('#area-radius');
  DOM.radiusInput = document.querySelector('#radius-value');
  DOM.rotationSlider = document.querySelector('#area-rotation');
  DOM.rotationInput = document.querySelector('#rotation-value');
  DOM.customWidth = document.querySelector('#custom-width');
  DOM.customHeight = document.querySelector('#custom-height');
  // Displays
  DOM.ratioValue = document.querySelector('#ratio-value');
  DOM.ratioDisplay = document.querySelector('#ratio-display');
  DOM.areaDisplay = document.querySelector('#area-display');
  DOM.tabletDimensions = document.querySelector('#tablet-dimensions');
  // Buttons
  DOM.themeBtn = document.querySelector('#theme-toggle');
  DOM.lockRatioBtn = document.querySelector('#lock-ratio');
  DOM.gridBtn = document.querySelector('#toggle-grid');
  DOM.gridIcon = document.querySelector('#grid-icon');
  DOM.fullAreaBtn = document.querySelector('#full-area');
  DOM.fullAreaIcon = document.querySelector('#fullarea-icon');
  DOM.recapBtn = document.querySelector('#show-recap');
  DOM.recapIcon = document.querySelector('#recap-icon');
  DOM.saveBtn = document.querySelector('#save-favorite');
  DOM.saveIcon = document.querySelector('#save-icon');
  DOM.proPlayersBtn = document.querySelector('#pro-players-btn');
  DOM.proPlayersIcon = document.querySelector('#pro-players-icon');
  DOM.comparisonToggle = document.querySelector('#toggle-comparison');
  DOM.comparisonIcon = document.querySelector('#comparison-icon');
  DOM.zoneABtn = document.querySelector('#zone-a-btn');
  DOM.zoneBBtn = document.querySelector('#zone-b-btn');
  // Containers
  DOM.visualizer = document.querySelector('#visualizer');
  DOM.tabletSelector = document.querySelector('#tablet-selector');
  DOM.favorites = document.querySelector('#favorites');
  DOM.customDimensions = document.querySelector('#custom-dimensions');
  DOM.zoneSelector = document.querySelector('#zone-selector');
  // Language
  DOM.langToggle = document.querySelector('#lang-toggle');
  DOM.langMenu = document.querySelector('#lang-menu');
  DOM.langDropdown = document.querySelector('#lang-dropdown');
  DOM.currentLang = document.querySelector('#current-lang');
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Save state to localStorage
 */
function saveState() {
  savePrefs({
    tablet: state.tablet,
    area: state.area,
    areaB: state.areaB,
    comparisonMode: state.comparisonMode,
    activeZone: state.activeZone,
    lockRatio: state.lockRatio,
    lockedRatio: state.lockedRatio,
    lockedRatioB: state.lockedRatioB,
    showGrid: state.showGrid,
  });
}

const debouncedSaveState = debounce(saveState, SAVE_DEBOUNCE_DELAY);

/**
 * Load state from localStorage
 */
function loadState() {
  const prefs = loadPrefs();
  if (!prefs) return;

  if (prefs.tablet) state.tablet = prefs.tablet;
  if (prefs.area) Object.assign(state.area, prefs.area);
  if (prefs.areaB) Object.assign(state.areaB, prefs.areaB);
  if (typeof prefs.comparisonMode === 'boolean') state.comparisonMode = prefs.comparisonMode;
  if (prefs.activeZone) state.activeZone = prefs.activeZone;
  if (typeof prefs.lockRatio === 'boolean') state.lockRatio = prefs.lockRatio;
  if (typeof prefs.lockedRatio === 'number') state.lockedRatio = prefs.lockedRatio;
  if (typeof prefs.lockedRatioB === 'number') state.lockedRatioB = prefs.lockedRatioB;
  if (typeof prefs.showGrid === 'boolean') state.showGrid = prefs.showGrid;
}

// ============================================================================
// HISTORY (UNDO/REDO)
// ============================================================================

function pushAreaToHistory() {
  historyPushState(getActiveArea(state));
}

const debouncedPushHistory = debounce(pushAreaToHistory, 500);

function handleUndo() {
  const activeArea = getActiveArea(state);
  const previousState = historyUndo(activeArea);
  if (previousState) {
    Object.assign(activeArea, previousState);
    syncActiveArea(state, setArea, setAreaB);
    setAreaRadius(activeArea.radius || 0);
    setAreaRotation(activeArea.rotation || 0);
    updateInputs();
    updateRatioDisplay();
    saveState();
  }
}

function handleRedo() {
  const activeArea = getActiveArea(state);
  const nextState = historyRedo(activeArea);
  if (nextState) {
    Object.assign(activeArea, nextState);
    syncActiveArea(state, setArea, setAreaB);
    setAreaRadius(activeArea.radius || 0);
    setAreaRotation(activeArea.rotation || 0);
    updateInputs();
    updateRatioDisplay();
    saveState();
  }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateInputs() {
  const activeArea = getActiveArea(state);
  if (DOM.widthInput) DOM.widthInput.value = formatNumber(activeArea.width, 1);
  if (DOM.heightInput) DOM.heightInput.value = formatNumber(activeArea.height, 1);
  updatePositionInputs();
  updateSliders();
  updateRatioDisplay();
}

function updatePositionInputs() {
  const activeArea = getActiveArea(state);
  if (DOM.posXInput) DOM.posXInput.value = formatNumber(activeArea.x, 1);
  if (DOM.posYInput) DOM.posYInput.value = formatNumber(activeArea.y, 1);
}

function updateSliders() {
  const activeArea = getActiveArea(state);
  const radius = activeArea.radius || 0;
  const rotation = activeArea.rotation || 0;
  if (DOM.radiusSlider) {
    DOM.radiusSlider.value = radius;
    DOM.radiusSlider.setAttribute('aria-valuenow', radius);
  }
  if (DOM.radiusInput) DOM.radiusInput.value = radius;
  if (DOM.rotationSlider) {
    DOM.rotationSlider.value = rotation;
    DOM.rotationSlider.setAttribute('aria-valuenow', rotation);
  }
  if (DOM.rotationInput) DOM.rotationInput.value = rotation;
}

function updateRatioDisplay() {
  const activeArea = getActiveArea(state);
  const ratio = calculateRatioString(activeArea.width, activeArea.height);
  if (DOM.ratioValue) DOM.ratioValue.textContent = ratio;
  if (DOM.ratioDisplay) DOM.ratioDisplay.textContent = ratio;
  if (DOM.areaDisplay) {
    DOM.areaDisplay.textContent = `${formatNumber(activeArea.width, 1)} × ${formatNumber(activeArea.height, 1)}`;
  }
}

function updateTabletInfo() {
  if (DOM.tabletDimensions && state.tablet) {
    DOM.tabletDimensions.textContent = `${formatNumber(state.tablet.width, 1)} × ${formatNumber(state.tablet.height, 1)} mm`;
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onTabletSelected(tablet) {
  state.tablet = tablet;
  setTablet(tablet.width, tablet.height);
  updateTabletInfo();

  if (tablet.isCustom) {
    if (DOM.customWidth) DOM.customWidth.value = tablet.width;
    if (DOM.customHeight) DOM.customHeight.value = tablet.height;
    DOM.customDimensions?.classList.remove('hidden');
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  } else {
    DOM.customDimensions?.classList.add('hidden');
  }

  if (state.area.width > tablet.width) state.area.width = tablet.width;
  if (state.area.height > tablet.height) state.area.height = tablet.height;
  state.area.x = tablet.width / 2;
  state.area.y = tablet.height / 2;
  clampAreaPosition(state);
  setArea(state.area);

  // Also clamp Zone B when tablet changes
  if (state.areaB.width > tablet.width) state.areaB.width = tablet.width;
  if (state.areaB.height > tablet.height) state.areaB.height = tablet.height;
  clampAreaPosition(state, 'B');
  setAreaB(state.areaB);

  updateInputs();
  saveState();
}

function onFavoriteSelected(favorite) {
  state.tablet = favorite.tablet;
  Object.assign(getActiveArea(state), favorite.area);
  setCurrentTablet(state.tablet);
  setTablet(state.tablet.width, state.tablet.height);
  syncActiveArea(state, setArea, setAreaB);
  setAreaRadius(getActiveArea(state).radius || 0);
  setAreaRotation(getActiveArea(state).rotation || 0);
  updateTabletInfo();
  updateInputs();
  pushAreaToHistory();
  saveState();
}

function onProPlayerSelected(player) {
  state.tablet = {
    brand: player.tablet.brand,
    model: player.tablet.model,
    width: player.tablet.width,
    height: player.tablet.height,
    isCustom: false,
  };
  Object.assign(getActiveArea(state), player.area);
  setCurrentTablet(state.tablet);
  setTablet(state.tablet.width, state.tablet.height);
  syncActiveArea(state, setArea, setAreaB);
  setAreaRadius(getActiveArea(state).radius || 0);
  setAreaRotation(getActiveArea(state).rotation || 0);
  updateTabletInfo();
  updateInputs();
  pushAreaToHistory();
  saveState();
}

function toggleComparisonMode() {
  state.comparisonMode = !state.comparisonMode;
  setComparisonMode(state.comparisonMode);
  DOM.comparisonToggle?.classList.toggle('active', state.comparisonMode);
  DOM.zoneSelector?.classList.toggle('hidden', !state.comparisonMode);

  if (state.comparisonMode && !state.areaB.width) {
    state.areaB = { ...state.area };
    setAreaB(state.areaB);
  }
  saveState();
}

function switchActiveZone(zone) {
  if (zone === state.activeZone) return;
  state.activeZone = zone;
  setActiveZone(zone);
  DOM.zoneABtn?.classList.toggle('active', zone === 'A');
  DOM.zoneBBtn?.classList.toggle('active', zone === 'B');
  updateInputs();
  saveState();
}

function showRecap() {
  if (!state.tablet) return;
  const { tablet, area } = state;
  showRecapModal({
    width: formatNumber(area.width),
    height: formatNumber(area.height),
    ratio: calculateRatioString(area.width, area.height),
    surface: (area.width * area.height).toFixed(1),
    coverageX: ((area.width / tablet.width) * 100).toFixed(1),
    coverageY: ((area.height / tablet.height) * 100).toFixed(1),
    position: `${formatNumber(area.x, 1)}, ${formatNumber(area.y, 1)}`,
  });
}

// ============================================================================
// CONTROLS SETUP
// ============================================================================

function setupControls() {
  // Theme
  setupThemeToggle(DOM.themeBtn);

  // Language
  setupLanguageDropdown({
    langToggle: DOM.langToggle,
    langMenu: DOM.langMenu,
    langDropdown: DOM.langDropdown,
    currentLang: DOM.currentLang,
  });

  // Area dimensions
  setupAreaDimensionInputs(DOM, forceUpdate => {
    if (!DOM.widthInput || !DOM.heightInput || !state.tablet) return;
    if (!forceUpdate && (DOM.widthInput.value === '' || DOM.heightInput.value === '')) return;
    const activeArea = getActiveArea(state);
    const width = parseFloat(DOM.widthInput.value) || activeArea.width;
    const height = parseFloat(DOM.heightInput.value) || activeArea.height;
    updateAreaDimensions(state, width, height, {
      onUpdate: () => {
        if (forceUpdate) {
          DOM.widthInput.value = formatNumber(getActiveArea(state).width, 1);
          DOM.heightInput.value = formatNumber(getActiveArea(state).height, 1);
          pushAreaToHistory();
        }
        updatePositionInputs();
        updateRatioDisplay();
        debouncedSaveState();
      },
    });
  }, _forceUpdate => {
    if (!DOM.widthInput || !DOM.heightInput || !state.tablet) return;
    const activeArea = getActiveArea(state);
    const width = parseFloat(DOM.widthInput.value) || activeArea.width;
    const height = parseFloat(DOM.heightInput.value) || activeArea.height;
    updateAreaDimensions(state, width, height, {
      onUpdate: () => {
        DOM.widthInput.value = formatNumber(getActiveArea(state).width, 1);
        DOM.heightInput.value = formatNumber(getActiveArea(state).height, 1);
        pushAreaToHistory();
        updatePositionInputs();
        updateRatioDisplay();
        debouncedSaveState();
      },
    });
  });

  // Position
  setupPositionInputs(DOM, forceUpdate => {
    if (!DOM.posXInput || !DOM.posYInput || !state.tablet) return;
    if (!forceUpdate && (DOM.posXInput.value === '' || DOM.posYInput.value === '')) return;
    const activeArea = getActiveArea(state);
    const x = parseFloat(DOM.posXInput.value) || activeArea.x;
    const y = parseFloat(DOM.posYInput.value) || activeArea.y;
    updateAreaPosition(state, x, y, {
      onUpdate: () => {
        if (forceUpdate) {
          DOM.posXInput.value = formatNumber(getActiveArea(state).x, 1);
          DOM.posYInput.value = formatNumber(getActiveArea(state).y, 1);
          pushAreaToHistory();
        }
        debouncedSaveState();
      },
    });
  }, _forceUpdate => {
    if (!DOM.posXInput || !DOM.posYInput || !state.tablet) return;
    const activeArea = getActiveArea(state);
    const x = parseFloat(DOM.posXInput.value) || activeArea.x;
    const y = parseFloat(DOM.posYInput.value) || activeArea.y;
    updateAreaPosition(state, x, y, {
      onUpdate: () => {
        DOM.posXInput.value = formatNumber(getActiveArea(state).x, 1);
        DOM.posYInput.value = formatNumber(getActiveArea(state).y, 1);
        pushAreaToHistory();
        debouncedSaveState();
      },
    });
  });

  // Radius
  setupRadiusControls(DOM, () => {
    const value = parseInt(DOM.radiusSlider?.value, 10) || 0;
    const finalValue = updateRadius(state, value, true);
    if (DOM.radiusSlider) DOM.radiusSlider.value = finalValue;
    if (DOM.radiusInput) DOM.radiusInput.value = finalValue;
    debouncedSaveState();
  }, () => {
    const value = parseInt(DOM.radiusInput?.value, 10) || 0;
    const finalValue = updateRadius(state, value, false);
    if (DOM.radiusSlider) DOM.radiusSlider.value = finalValue;
    if (DOM.radiusInput) DOM.radiusInput.value = finalValue;
    debouncedSaveState();
  });

  // Rotation
  setupRotationControls(DOM, () => {
    const value = parseInt(DOM.rotationSlider?.value, 10) || 0;
    const finalValue = updateRotation(state, value, true);
    if (DOM.rotationSlider) DOM.rotationSlider.value = finalValue;
    if (DOM.rotationInput) DOM.rotationInput.value = finalValue;
    debouncedSaveState();
  }, () => {
    const value = parseInt(DOM.rotationInput?.value, 10) || 0;
    const finalValue = updateRotation(state, value, false);
    if (DOM.rotationSlider) DOM.rotationSlider.value = finalValue;
    if (DOM.rotationInput) DOM.rotationInput.value = finalValue;
    debouncedSaveState();
  });

  // Lock ratio
  setupLockRatioToggle(DOM, state, () => saveState());

  // Grid
  setupGridToggle(DOM, state, () => saveState());

  // Toolbar buttons
  setupToolbarButtons(DOM, {
    onFullArea: () => setFullArea(state, {
      onUpdate: () => {
        updateInputs();
        pushAreaToHistory();
        saveState();
      },
    }),
    onRecap: showRecap,
    onSaveFavorite: () => {
      if (state.tablet) {
        saveCurrentAsFavorite(state.tablet, getActiveArea(state));
      }
    },
    onToggleComparison: toggleComparisonMode,
  });

  // Zone selector
  setupZoneSelector(DOM, switchActiveZone);

  // Custom dimensions
  setupCustomDimensions(DOM, state, (w, h) => {
    state.tablet.width = w;
    state.tablet.height = h;
    setTablet(w, h);
    updateTabletInfo();
    clampAreaPosition(state);
    centerArea(state, { onUpdate: updatePositionInputs });
    saveState();
  });

  // Ratio presets
  setupRatioPresets(state, targetRatio => {
    applyRatioPreset(state, targetRatio, {
      onUpdate: () => {
        updateInputs();
        pushAreaToHistory();
        saveState();
      },
    });
  });

  // Area change from visualizer drag
  setupAreaChangeListener(state, () => {
    updateInputs();
    debouncedPushHistory();
    debouncedSaveState();
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  cacheDOMElements();
  loadState();
  await initI18n();
  initTheme();
  updateLangDisplay(DOM.currentLang);
  translatePage();

  // Visualizer
  if (DOM.visualizer) {
    initVisualizer(DOM.visualizer);
    if (state.tablet) {
      setTablet(state.tablet.width, state.tablet.height);
      clampAreaPosition(state, 'A');
      clampAreaPosition(state, 'B');
      setArea(state.area);
      setAreaB(state.areaB);
      setAreaRadius(state.area.radius || 0);
      setAreaRotation(state.area.rotation || 0);
    }
    setGridVisible(state.showGrid);
    setComparisonMode(state.comparisonMode);
    setActiveZone(state.activeZone);
  }

  // Tablet selector
  if (DOM.tabletSelector) {
    await initTabletSelector(DOM.tabletSelector, onTabletSelected);
    if (state.tablet) {
      setCurrentTablet(state.tablet);
      updateTabletInfo();
    }
  }

  // Favorites
  if (DOM.favorites) {
    initFavorites(DOM.favorites, onFavoriteSelected);
  }

  // Pro players (lazy-loaded on first modal open)
  initProPlayers(onProPlayerSelected);

  // Keyboard shortcuts
  initKeyboardShortcuts(handleUndo, handleRedo);

  setupControls();
  updateInputs();

  if (state.tablet) {
    pushAreaToHistory();
  }

  // Comparison mode UI
  if (state.comparisonMode) {
    DOM.comparisonToggle?.classList.add('active');
    DOM.zoneSelector?.classList.remove('hidden');
    DOM.zoneABtn?.classList.toggle('active', state.activeZone === 'A');
    DOM.zoneBBtn?.classList.toggle('active', state.activeZone === 'B');
  }
}

// Exports for favorites edit
export {
  state,
  updateInputs,
  setArea,
  setAreaB,
  setAreaRadius,
  setAreaRotation,
  setTablet,
  setCurrentTablet,
  updateTabletInfo,
};

// Global error handlers
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

window.addEventListener('error', event => {
  console.error('Uncaught error:', event.error);
});

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
