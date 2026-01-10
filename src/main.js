/**
 * Osu!rea - Main Entry Point
 * Tablet area visualizer for osu!
 */

import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';

import { initI18n, translatePage, setLocale, getLocale } from './modules/i18n.js';
import { loadPrefs, savePrefs, getTheme, setTheme } from './modules/storage.js';
import { icon } from './modules/icons.js';
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
import { initProPlayers, openProPlayersModal } from './modules/pro-players.js';
import { clamp, debounce, calculateRatioString, formatNumber } from './modules/utils.js';
import { showRecapModal } from './modules/modal.js';
import {
  pushState as historyPushState,
  undo as historyUndo,
  redo as historyRedo,
  initKeyboardShortcuts,
  clearHistory,
} from './modules/history.js';

// App state
const state = {
  tablet: null,
  area: { x: 0, y: 0, width: 100, height: 62.5, radius: 0, rotation: 0 },
  areaB: { x: 0, y: 0, width: 100, height: 62.5, radius: 0, rotation: 0 },
  comparisonMode: false,
  activeZone: 'A',
  lockRatio: true,
  lockedRatio: 16 / 9, // Captured ratio when lock is enabled (default 16:9)
  lockedRatioB: 16 / 9, // Captured ratio for zone B
  showGrid: true,
};

// DOM element cache to avoid repeated querySelector calls
const DOM = {
  // Inputs
  widthInput: null,
  heightInput: null,
  posXInput: null,
  posYInput: null,
  radiusSlider: null,
  radiusInput: null,
  rotationSlider: null,
  rotationInput: null,
  customWidth: null,
  customHeight: null,
  // Displays
  ratioValue: null,
  ratioDisplay: null,
  areaDisplay: null,
  tabletDimensions: null,
  // Buttons
  themeBtn: null,
  lockRatioBtn: null,
  gridBtn: null,
  gridIcon: null,
  fullAreaBtn: null,
  recapBtn: null,
  saveBtn: null,
  proPlayersBtn: null,
  comparisonToggle: null,
  zoneABtn: null,
  zoneBBtn: null,
  // Containers
  visualizer: null,
  tabletSelector: null,
  favorites: null,
  customDimensions: null,
  zoneSelector: null,
  // Language
  langToggle: null,
  langMenu: null,
  langDropdown: null,
  currentLang: null,
};

/**
 * Cache DOM element references
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

/**
 * Push current area state to history (for undo/redo)
 */
function pushAreaToHistory() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  historyPushState(activeArea);
}

/**
 * Handle undo action
 */
function handleUndo() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  const previousState = historyUndo(activeArea);
  
  if (previousState) {
    Object.assign(activeArea, previousState);
    
    if (state.activeZone === 'A') {
      setArea(state.area);
    } else {
      setAreaB(state.areaB);
    }
    
    setAreaRadius(activeArea.radius || 0);
    setAreaRotation(activeArea.rotation || 0);
    updateInputs();
    updateRatioDisplay();
    saveState();
  }
}

/**
 * Handle redo action
 */
function handleRedo() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  const nextState = historyRedo(activeArea);
  
  if (nextState) {
    Object.assign(activeArea, nextState);
    
    if (state.activeZone === 'A') {
      setArea(state.area);
    } else {
      setAreaB(state.areaB);
    }
    
    setAreaRadius(activeArea.radius || 0);
    setAreaRotation(activeArea.rotation || 0);
    updateInputs();
    updateRatioDisplay();
    saveState();
  }
}

/**
 * Initialize theme
 */
function initTheme() {
  const theme = getTheme();
  document.documentElement.dataset.theme = theme;
  updateThemeIcon();
}

/**
 * Update theme icon
 */
function updateThemeIcon() {
  if (DOM.themeBtn) {
    const theme = getTheme();
    DOM.themeBtn.innerHTML = icon(theme === 'dark' ? 'moon' : 'sun');
  }
}

/**
 * Toggle theme
 */
function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  document.documentElement.dataset.theme = next;
  updateThemeIcon();
}

/**
 * Select a specific language
 */
async function selectLanguage(locale) {
  await setLocale(locale);
  translatePage();
  updateLangDisplay();
  updateLangMenuActive();
  hideLangMenu();
}

/**
 * Toggle language menu visibility
 */
function toggleLangMenu() {
  if (DOM.langMenu && DOM.langToggle) {
    const isHidden = DOM.langMenu.classList.contains('hidden');
    DOM.langMenu.classList.toggle('hidden');
    DOM.langToggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  }
}

/**
 * Hide language menu
 */
function hideLangMenu() {
  if (DOM.langMenu && DOM.langToggle) {
    DOM.langMenu.classList.add('hidden');
    DOM.langToggle.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Update active state in language menu
 */
function updateLangMenuActive() {
  const currentLocale = getLocale();
  document.querySelectorAll('.lang-option').forEach(option => {
    const isActive = option.dataset.locale === currentLocale;
    option.classList.toggle('active', isActive);
  });
}

/**
 * Update language display
 */
function updateLangDisplay() {
  if (DOM.currentLang) {
    DOM.currentLang.textContent = getLocale().toUpperCase();
  }
}

/**
 * Update area dimensions from inputs
 */
function updateAreaFromInputs(forceUpdate = false) {
  if (!DOM.widthInput || !DOM.heightInput || !state.tablet) return;

  // Don't update if input is empty (user is typing)
  if (!forceUpdate && (DOM.widthInput.value === '' || DOM.heightInput.value === '')) {
    return;
  }

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;

  let width = parseFloat(DOM.widthInput.value) || activeArea.width;
  let height = parseFloat(DOM.heightInput.value) || activeArea.height;

  // Clamp to tablet bounds
  width = clamp(width, 1, state.tablet.width);
  height = clamp(height, 1, state.tablet.height);

  // Keep aspect ratio if locked
  if (state.lockRatio) {
    const targetRatio = state.activeZone === 'A' ? state.lockedRatio : state.lockedRatioB;
    const { height: tabletHeight } = state.tablet;
    height = width / targetRatio;
    if (height > tabletHeight) {
      height = tabletHeight;
      width = height * targetRatio;
    }
  }

  activeArea.width = width;
  activeArea.height = height;

  clampAreaPosition();

  // Only update input values on forceUpdate (blur/change event)
  if (forceUpdate) {
    DOM.widthInput.value = formatNumber(activeArea.width, 1);
    DOM.heightInput.value = formatNumber(activeArea.height, 1);
    pushAreaToHistory();
  }

  if (state.activeZone === 'A') {
    setArea(state.area);
  } else {
    setAreaB(state.areaB);
  }

  updatePositionInputs();
  updateRatioDisplay();
  debouncedSaveState();
}

/**
 * Update area position from inputs
 */
function updatePositionFromInputs(forceUpdate = false) {
  if (!DOM.posXInput || !DOM.posYInput || !state.tablet) return;

  // Don't update if input is empty (user is typing)
  if (!forceUpdate && (DOM.posXInput.value === '' || DOM.posYInput.value === '')) {
    return;
  }

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;

  const x = parseFloat(DOM.posXInput.value) || activeArea.x;
  const y = parseFloat(DOM.posYInput.value) || activeArea.y;

  activeArea.x = x;
  activeArea.y = y;

  clampAreaPosition();

  // Only update input values on forceUpdate (blur/change event)
  if (forceUpdate) {
    DOM.posXInput.value = formatNumber(activeArea.x, 1);
    DOM.posYInput.value = formatNumber(activeArea.y, 1);
    pushAreaToHistory();
  }

  if (state.activeZone === 'A') {
    setArea(state.area);
  } else {
    setAreaB(state.areaB);
  }

  debouncedSaveState();
}

/**
 * Snap value to nearest snap point if within threshold
 * @param {number} value - Current value
 * @param {number[]} snapPoints - Array of snap points
 * @param {number} threshold - Distance threshold for snapping
 * @returns {number} - Snapped value or original
 */
function snapToPoint(value, snapPoints, threshold = 5) {
  for (const point of snapPoints) {
    if (Math.abs(value - point) <= threshold) {
      return point;
    }
  }
  return value;
}

/**
 * Update radius from slider
 */
function updateRadiusFromSlider() {
  if (!DOM.radiusSlider) return;

  let radius = parseInt(DOM.radiusSlider.value, 10) || 0;

  // Snap to key points: 0%, 50%, 100%
  radius = snapToPoint(radius, [0, 50, 100], 2);

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  activeArea.radius = radius;

  // Update slider position if snapped
  DOM.radiusSlider.value = radius;

  if (DOM.radiusInput) {
    DOM.radiusInput.value = radius;
  }

  setAreaRadius(radius);
  debouncedSaveState();
}

/**
 * Update radius from manual input (no snapping)
 */
function updateRadiusFromInput() {
  if (!DOM.radiusInput) return;

  let radius = parseInt(DOM.radiusInput.value, 10) || 0;
  radius = clamp(radius, 0, 100);

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  activeArea.radius = radius;

  if (DOM.radiusSlider) {
    DOM.radiusSlider.value = radius;
  }
  DOM.radiusInput.value = radius;

  setAreaRadius(radius);
  debouncedSaveState();
}

/**
 * Update rotation from slider
 */
function updateRotationFromSlider() {
  if (!DOM.rotationSlider) return;

  let rotation = parseInt(DOM.rotationSlider.value, 10) || 0;

  // Snap to key angles: -180°, -90°, 0°, 90°, 180°
  rotation = snapToPoint(rotation, [-180, -90, 0, 90, 180], 2);

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  activeArea.rotation = rotation;

  // Update slider position if snapped
  DOM.rotationSlider.value = rotation;

  if (DOM.rotationInput) {
    DOM.rotationInput.value = rotation;
  }

  setAreaRotation(rotation);
  debouncedSaveState();
}

/**
 * Update rotation from manual input (no snapping)
 */
function updateRotationFromInput() {
  if (!DOM.rotationInput) return;

  let rotation = parseInt(DOM.rotationInput.value, 10) || 0;
  rotation = clamp(rotation, -180, 180);

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  activeArea.rotation = rotation;

  if (DOM.rotationSlider) {
    DOM.rotationSlider.value = rotation;
  }
  DOM.rotationInput.value = rotation;

  setAreaRotation(rotation);
  debouncedSaveState();
}

/**
 * Clamp area position within tablet bounds
 */
function clampAreaPosition() {
  if (!state.tablet) return;

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;

  const halfW = activeArea.width / 2;
  const halfH = activeArea.height / 2;

  activeArea.x = clamp(activeArea.x, halfW, state.tablet.width - halfW);
  activeArea.y = clamp(activeArea.y, halfH, state.tablet.height - halfH);
}

/**
 * Center the area
 */
function centerArea() {
  if (!state.tablet) return;

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;

  activeArea.x = state.tablet.width / 2;
  activeArea.y = state.tablet.height / 2;

  if (state.activeZone === 'A') {
    setArea(state.area);
  } else {
    setAreaB(state.areaB);
  }

  updatePositionInputs();
  pushAreaToHistory();
  saveState();
}

/**
 * Set area to full tablet size
 */
function setFullArea() {
  if (!state.tablet) return;

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;

  if (state.lockRatio) {
    const targetRatio = state.activeZone === 'A' ? state.lockedRatio : state.lockedRatioB;
    const tabletRatio = state.tablet.width / state.tablet.height;

    if (tabletRatio > targetRatio) {
      activeArea.height = state.tablet.height;
      activeArea.width = activeArea.height * targetRatio;
    } else {
      activeArea.width = state.tablet.width;
      activeArea.height = activeArea.width / targetRatio;
    }
  } else {
    activeArea.width = state.tablet.width;
    activeArea.height = state.tablet.height;
  }

  activeArea.x = state.tablet.width / 2;
  activeArea.y = state.tablet.height / 2;

  if (state.activeZone === 'A') {
    setArea(state.area);
  } else {
    setAreaB(state.areaB);
  }

  updateInputs();
  updateRatioDisplay();
  pushAreaToHistory();
  saveState();
}

/**
 * Update ratio display
 */
function updateRatioDisplay() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  const ratio = calculateRatioString(activeArea.width, activeArea.height);

  if (DOM.ratioValue) DOM.ratioValue.textContent = ratio;
  if (DOM.ratioDisplay) DOM.ratioDisplay.textContent = ratio;

  // Update area display in visualizer
  if (DOM.areaDisplay) {
    DOM.areaDisplay.textContent = `${formatNumber(
      activeArea.width,
      1
    )} × ${formatNumber(activeArea.height, 1)}`;
  }
}

/**
 * Update tablet info display
 */
function updateTabletInfo() {
  if (DOM.tabletDimensions && state.tablet) {
    DOM.tabletDimensions.textContent = `${formatNumber(
      state.tablet.width,
      1
    )} × ${formatNumber(state.tablet.height, 1)} mm`;
  }
}

/**
 * Get recap data
 */
function getRecapData() {
  if (!state.tablet) return null;

  const { tablet, area } = state;
  return {
    width: formatNumber(area.width),
    height: formatNumber(area.height),
    ratio: calculateRatioString(area.width, area.height),
    surface: (area.width * area.height).toFixed(1),
    coverageX: ((area.width / tablet.width) * 100).toFixed(1),
    coverageY: ((area.height / tablet.height) * 100).toFixed(1),
    position: `${formatNumber(area.x, 1)}, ${formatNumber(area.y, 1)}`,
  };
}

/**
 * Show recap modal
 */
function showRecap() {
  const data = getRecapData();
  if (data) {
    showRecapModal(data);
  }
}

/**
 * Save state to localStorage
 */
function saveState() {
  const prefs = {
    tablet: state.tablet,
    area: state.area,
    areaB: state.areaB,
    comparisonMode: state.comparisonMode,
    activeZone: state.activeZone,
    lockRatio: state.lockRatio,
    lockedRatio: state.lockedRatio,
    lockedRatioB: state.lockedRatioB,
    showGrid: state.showGrid,
  };
  savePrefs(prefs);
}

const debouncedSaveState = debounce(saveState, 300);
const debouncedPushHistory = debounce(pushAreaToHistory, 500);

/**
 * Load state from localStorage
 */
function loadState() {
  const prefs = loadPrefs();
  if (prefs) {
    if (prefs.tablet) state.tablet = prefs.tablet;
    if (prefs.area) state.area = { ...state.area, ...prefs.area };
    if (prefs.areaB) state.areaB = { ...state.areaB, ...prefs.areaB };
    if (typeof prefs.comparisonMode === 'boolean') state.comparisonMode = prefs.comparisonMode;
    if (prefs.activeZone) state.activeZone = prefs.activeZone;
    if (typeof prefs.lockRatio === 'boolean') state.lockRatio = prefs.lockRatio;
    if (typeof prefs.lockedRatio === 'number') state.lockedRatio = prefs.lockedRatio;
    if (typeof prefs.lockedRatioB === 'number') state.lockedRatioB = prefs.lockedRatioB;
    if (typeof prefs.showGrid === 'boolean') state.showGrid = prefs.showGrid;
  }
}

/**
 * Handle tablet selection
 */
function onTabletSelected(tablet) {
  state.tablet = tablet;
  setTablet(tablet.width, tablet.height);

  updateTabletInfo();

  if (tablet.isCustom) {
    if (DOM.customWidth) DOM.customWidth.value = tablet.width;
    if (DOM.customHeight) DOM.customHeight.value = tablet.height;
    DOM.customDimensions?.classList.remove('hidden');

    // Reset preset buttons active state
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  } else {
    DOM.customDimensions?.classList.add('hidden');
  }

  if (state.area.width > tablet.width) state.area.width = tablet.width;
  if (state.area.height > tablet.height) state.area.height = tablet.height;

  state.area.x = tablet.width / 2;
  state.area.y = tablet.height / 2;
  clampAreaPosition();

  setArea(state.area);
  updateInputs();
  updateRatioDisplay();
  saveState();
}

/**
 * Update all input values from state
 */
function updateInputs() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;

  if (DOM.widthInput) DOM.widthInput.value = formatNumber(activeArea.width, 1);
  if (DOM.heightInput) DOM.heightInput.value = formatNumber(activeArea.height, 1);

  updatePositionInputs();
  updateRadiusSlider();
  updateRotationSlider();
  updateRatioDisplay();
}

/**
 * Update position inputs from state
 */
function updatePositionInputs() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;

  if (DOM.posXInput) DOM.posXInput.value = formatNumber(activeArea.x, 1);
  if (DOM.posYInput) DOM.posYInput.value = formatNumber(activeArea.y, 1);
}

/**
 * Update radius slider from state
 */
function updateRadiusSlider() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  const radius = activeArea.radius || 0;
  if (DOM.radiusSlider) DOM.radiusSlider.value = radius;
  if (DOM.radiusInput) DOM.radiusInput.value = radius;
}

/**
 * Update rotation slider from state
 */
function updateRotationSlider() {
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  const rotation = activeArea.rotation || 0;
  if (DOM.rotationSlider) DOM.rotationSlider.value = rotation;
  if (DOM.rotationInput) DOM.rotationInput.value = rotation;
}

/**
 * Handle favorite selection
 */
function onFavoriteSelected(favorite) {
  state.tablet = favorite.tablet;
  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  Object.assign(activeArea, favorite.area);

  setCurrentTablet(state.tablet);
  setTablet(state.tablet.width, state.tablet.height);

  if (state.activeZone === 'A') {
    setArea(state.area);
  } else {
    setAreaB(state.areaB);
  }

  setAreaRadius(activeArea.radius || 0);
  setAreaRotation(activeArea.rotation || 0);

  updateTabletInfo();
  updateInputs();
  pushAreaToHistory();
  saveState();
}

/**
 * Handle pro player selection
 */
function onProPlayerSelected(player) {
  state.tablet = {
    brand: player.tablet.brand,
    model: player.tablet.model,
    width: player.tablet.width,
    height: player.tablet.height,
    isCustom: false,
  };

  const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
  Object.assign(activeArea, player.area);

  setCurrentTablet(state.tablet);
  setTablet(state.tablet.width, state.tablet.height);

  if (state.activeZone === 'A') {
    setArea(state.area);
  } else {
    setAreaB(state.areaB);
  }

  setAreaRadius(activeArea.radius || 0);
  setAreaRotation(activeArea.rotation || 0);

  updateTabletInfo();
  updateInputs();
  pushAreaToHistory();
  saveState();
}

/**
 * Toggle comparison mode
 */
function toggleComparisonMode() {
  state.comparisonMode = !state.comparisonMode;
  setComparisonMode(state.comparisonMode);

  DOM.comparisonToggle?.classList.toggle('active', state.comparisonMode);
  DOM.zoneSelector?.classList.toggle('hidden', !state.comparisonMode);

  // If turning on comparison, initialize areaB from areaA
  if (state.comparisonMode && !state.areaB.width) {
    state.areaB = { ...state.area };
    setAreaB(state.areaB);
  }

  saveState();
}

/**
 * Switch active zone (A or B)
 */
function switchActiveZone(zone) {
  if (zone === state.activeZone) return;

  state.activeZone = zone;
  setActiveZone(zone);

  // Update UI
  DOM.zoneABtn?.classList.toggle('active', zone === 'A');
  DOM.zoneBBtn?.classList.toggle('active', zone === 'B');

  // Update all inputs for the new active zone
  updateInputs();
  saveState();
}

/**
 * Initialize app
 */
async function init() {
  // Cache DOM elements first
  cacheDOMElements();

  loadState();

  await initI18n();

  initTheme();
  updateLangDisplay();

  translatePage();

  // Initialize visualizer
  if (DOM.visualizer) {
    initVisualizer(DOM.visualizer);

    if (state.tablet) {
      setTablet(state.tablet.width, state.tablet.height);
      clampAreaPosition();
      setArea(state.area);
      setAreaB(state.areaB);
      setAreaRadius(state.area.radius || 0);
      setAreaRotation(state.area.rotation || 0);
    }

    setGridVisible(state.showGrid);
    setComparisonMode(state.comparisonMode);
    setActiveZone(state.activeZone);
  }

  // Initialize tablet selector
  if (DOM.tabletSelector) {
    await initTabletSelector(DOM.tabletSelector, onTabletSelected);

    if (state.tablet) {
      setCurrentTablet(state.tablet);
      updateTabletInfo();
    }
  }

  // Initialize favorites
  if (DOM.favorites) {
    initFavorites(DOM.favorites, onFavoriteSelected);
  }

  // Initialize pro players
  await initProPlayers(onProPlayerSelected);

  // Initialize keyboard shortcuts for undo/redo
  initKeyboardShortcuts(handleUndo, handleRedo);

  setupControls();

  updateInputs();

  // Push initial state to history
  if (state.tablet) {
    pushAreaToHistory();
  }

  // Initialize comparison mode UI state
  if (state.comparisonMode) {
    DOM.comparisonToggle?.classList.add('active');
    DOM.zoneSelector?.classList.remove('hidden');
    DOM.zoneABtn?.classList.toggle('active', state.activeZone === 'A');
    DOM.zoneBBtn?.classList.toggle('active', state.activeZone === 'B');
  }
}

/**
 * Setup control event listeners
 */
function setupControls() {
  // Theme toggle
  if (DOM.themeBtn) {
    DOM.themeBtn.addEventListener('click', toggleTheme);
  }

  // Language dropdown
  if (DOM.langToggle && DOM.langMenu) {
    DOM.langToggle.addEventListener('click', e => {
      e.stopPropagation();
      toggleLangMenu();
    });

    // Language option clicks
    document.querySelectorAll('.lang-option').forEach(option => {
      option.addEventListener('click', () => {
        selectLanguage(option.dataset.locale);
      });
    });

    // Close on click outside
    document.addEventListener('click', e => {
      if (DOM.langDropdown && !DOM.langDropdown.contains(e.target)) {
        hideLangMenu();
      }
    });

    // Close on escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        hideLangMenu();
      }
    });

    // Set initial active state
    updateLangMenuActive();
  }

  // Area dimension inputs
  DOM.widthInput?.addEventListener(
    'input',
    debounce(() => updateAreaFromInputs(false), 200)
  );
  DOM.heightInput?.addEventListener(
    'input',
    debounce(() => updateAreaFromInputs(false), 200)
  );
  DOM.widthInput?.addEventListener('change', () => updateAreaFromInputs(true));
  DOM.heightInput?.addEventListener('change', () => updateAreaFromInputs(true));

  // Position inputs
  DOM.posXInput?.addEventListener(
    'input',
    debounce(() => updatePositionFromInputs(false), 200)
  );
  DOM.posYInput?.addEventListener(
    'input',
    debounce(() => updatePositionFromInputs(false), 200)
  );
  DOM.posXInput?.addEventListener('change', () => updatePositionFromInputs(true));
  DOM.posYInput?.addEventListener('change', () => updatePositionFromInputs(true));

  // Radius slider and manual input
  DOM.radiusSlider?.addEventListener('input', updateRadiusFromSlider);
  DOM.radiusInput?.addEventListener('change', updateRadiusFromInput);

  // Rotation slider and manual input
  DOM.rotationSlider?.addEventListener('input', updateRotationFromSlider);
  DOM.rotationInput?.addEventListener('change', updateRotationFromInput);

  // Lock ratio toggle
  if (DOM.lockRatioBtn) {
    DOM.lockRatioBtn.classList.toggle('active', state.lockRatio);
    DOM.lockRatioBtn.innerHTML = icon(state.lockRatio ? 'lock' : 'unlock');

    DOM.lockRatioBtn.addEventListener('click', () => {
      state.lockRatio = !state.lockRatio;
      DOM.lockRatioBtn.classList.toggle('active', state.lockRatio);
      DOM.lockRatioBtn.innerHTML = icon(state.lockRatio ? 'lock' : 'unlock');

      if (state.lockRatio) {
        // Capture the current ratio when lock is enabled
        const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
        const currentRatio = activeArea.width / activeArea.height;
        if (state.activeZone === 'A') {
          state.lockedRatio = currentRatio;
        } else {
          state.lockedRatioB = currentRatio;
        }
      }

      saveState();
    });
  }

  // Grid toggle (toolbar)
  if (DOM.gridBtn && DOM.gridIcon) {
    DOM.gridBtn.classList.toggle('active', state.showGrid);
    DOM.gridIcon.innerHTML = icon('grid');

    DOM.gridBtn.addEventListener('click', () => {
      state.showGrid = !state.showGrid;
      DOM.gridBtn.classList.toggle('active', state.showGrid);
      setGridVisible(state.showGrid);
      saveState();
    });
  }

  // Full area button (toolbar)
  if (DOM.fullAreaBtn && DOM.fullAreaIcon) {
    DOM.fullAreaIcon.innerHTML = icon('crop');
    DOM.fullAreaBtn.addEventListener('click', setFullArea);
  }

  // Recap button (toolbar)
  if (DOM.recapBtn && DOM.recapIcon) {
    DOM.recapIcon.innerHTML = icon('info');
    DOM.recapBtn.addEventListener('click', showRecap);
  }

  // Save favorite button
  if (DOM.saveIcon) {
    DOM.saveIcon.innerHTML = icon('heart');
  }
  DOM.saveBtn?.addEventListener('click', () => {
    if (state.tablet) {
      const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
      saveCurrentAsFavorite(state.tablet, activeArea);
    }
  });

  // Pro Players button
  if (DOM.proPlayersIcon) {
    DOM.proPlayersIcon.innerHTML = icon('users');
  }
  DOM.proPlayersBtn?.addEventListener('click', openProPlayersModal);

  // Comparison mode toggle
  if (DOM.comparisonIcon) {
    DOM.comparisonIcon.innerHTML = icon('layers');
  }
  DOM.comparisonToggle?.addEventListener('click', toggleComparisonMode);

  // Zone selector buttons
  DOM.zoneABtn?.addEventListener('click', () => switchActiveZone('A'));
  DOM.zoneBBtn?.addEventListener('click', () => switchActiveZone('B'));

  // Custom dimensions inputs
  const updateCustomDimensions = () => {
    if (state.tablet?.isCustom) {
      const w = parseFloat(DOM.customWidth?.value) || 152;
      const h = parseFloat(DOM.customHeight?.value) || 95;
      state.tablet.width = w;
      state.tablet.height = h;
      setTablet(w, h);
      updateTabletInfo();
      clampAreaPosition();
      centerArea();
      saveState();
    }
  };

  DOM.customWidth?.addEventListener('change', updateCustomDimensions);
  DOM.customHeight?.addEventListener('change', updateCustomDimensions);

  // Ratio preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.tablet) return;

      const activeArea = state.activeZone === 'A' ? state.area : state.areaB;
      const ratioStr = btn.dataset.ratio;
      const [ratioW, ratioH] = ratioStr.split(':').map(Number);
      const targetRatio = ratioW / ratioH;

      // Update active state
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Apply ratio to area
      const currentWidth = activeArea.width;
      let newHeight = currentWidth / targetRatio;

      // Clamp to tablet bounds
      if (newHeight > state.tablet.height) {
        newHeight = state.tablet.height;
        activeArea.width = newHeight * targetRatio;
      }

      activeArea.height = newHeight;
      clampAreaPosition();

      if (state.activeZone === 'A') {
        setArea(state.area);
      } else {
        setAreaB(state.areaB);
      }

      updateInputs();
      updateRatioDisplay();
      pushAreaToHistory();
      saveState();
    });
  });

  // Listen for area changes from visualizer (drag)
  window.addEventListener('area-changed', e => {
    const zone = e.detail.zone || 'A';
    if (zone === 'A') {
      state.area = { ...state.area, ...e.detail };
    } else {
      state.areaB = { ...state.areaB, ...e.detail };
    }
    updateInputs();
    debouncedPushHistory();
    debouncedSaveState();
  });
}

// Export for use in favorites edit
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

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
