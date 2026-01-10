/**
 * Osu!rea - Controllers Index
 * Centralized exports for all controllers
 * @module controllers
 */

// Area manipulation
export {
  snapToPoint,
  clampAreaPosition,
  centerArea,
  setFullArea,
  updateAreaDimensions,
  updateAreaPosition,
  updateRadius,
  updateRotation,
  applyRatioPreset,
  getActiveRatioString,
  getAreaDimensionsString,
} from './areaController.js';

// Theme management
export {
  initTheme,
  getCurrentTheme,
  updateThemeIcon,
  toggleTheme,
  setupThemeToggle,
} from './themeController.js';

// Language selection
export {
  selectLanguage,
  toggleLangMenu,
  hideLangMenu,
  updateLangMenuActive,
  updateLangDisplay,
  setupLanguageDropdown,
} from './languageController.js';

// Controls setup
export {
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
} from './controlsSetup.js';
