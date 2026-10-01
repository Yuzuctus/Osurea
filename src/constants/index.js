/**
 * Osu!rea - Constants
 * Centralized application constants
 */

/**
 * Default tablet configuration (Wacom CTL-472)
 * @constant {Object}
 */
export const DEFAULT_TABLET = {
  brand: 'Wacom',
  model: 'CTL-472 Small (One by Wacom S)',
  width: 152,
  height: 95,
  isCustom: false,
};

/**
 * Default area configuration
 * @constant {Object}
 */
export const DEFAULT_AREA = {
  x: 76,
  y: 47.5,
  width: 76,
  height: 47.5,
  radius: 0,
  rotation: 0,
};

/**
 * Maximum scale for visualizer
 * Allows small tablets to fill more of the available space
 * @constant {number}
 */
export const MAX_VISUALIZER_SCALE = 12;

/**
 * Visualizer padding in pixels
 * @constant {number}
 */
export const VISUALIZER_PADDING = 16;

/**
 * Grid step drawn on the tablet, in millimetres
 * @constant {number}
 */
export const GRID_STEP_MM = 10;

/**
 * Keyboard nudge of the area, in millimetres (Shift multiplies by 10)
 * @constant {number}
 */
export const KEYBOARD_STEP_MM = 1;

/**
 * Debounce delay for input updates (ms)
 * @constant {number}
 */
export const INPUT_DEBOUNCE_DELAY = 200;

/**
 * Debounce delay for state saving (ms)
 * @constant {number}
 */
export const SAVE_DEBOUNCE_DELAY = 300;

/**
 * Throttle delay for resize events (ms)
 * @constant {number}
 */
export const RESIZE_THROTTLE_DELAY = 100;

/**
 * Maximum undo/redo history size
 * @constant {number}
 */
export const MAX_HISTORY_SIZE = 50;

/**
 * Storage keys
 * @constant {Object}
 */
export const STORAGE_KEYS = {
  PREFS: 'osurea:prefs',
  FAVORITES: 'osurea:favorites',
  LOCALE: 'osurea:locale',
  THEME: 'osurea:theme',
};

/**
 * Supported locales
 * @constant {string[]}
 */
export const SUPPORTED_LOCALES = ['en', 'fr', 'es'];

/**
 * Default locale
 * @constant {string}
 */
export const DEFAULT_LOCALE = 'en';

/**
 * Common ratio definitions for ratio detection
 * @constant {Object[]}
 */
export const COMMON_RATIOS = [
  { w: 16, h: 9, ratio: 16 / 9 },
  { w: 16, h: 10, ratio: 16 / 10 },
  { w: 4, h: 3, ratio: 4 / 3 },
  { w: 21, h: 9, ratio: 21 / 9 },
  { w: 3, h: 2, ratio: 3 / 2 },
  { w: 1, h: 1, ratio: 1 },
];

/**
 * Ratio tolerance for matching common ratios (1%)
 * @constant {number}
 */
export const RATIO_TOLERANCE = 0.01;
