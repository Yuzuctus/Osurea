/**
 * Osu!rea - Constants
 * Centralized application constants
 */

/**
 * Standard aspect ratio 16:9 (commonly used in osu!)
 * @constant {number}
 */
export const ASPECT_RATIO_16_9 = 16 / 9;

/**
 * Standard aspect ratio 4:3
 * @constant {number}
 */
export const ASPECT_RATIO_4_3 = 4 / 3;

/**
 * Standard aspect ratio 16:10
 * @constant {number}
 */
export const ASPECT_RATIO_16_10 = 16 / 10;

/**
 * Available preset ratios
 * @constant {Object[]}
 */
export const PRESET_RATIOS = [
  { name: '16:9', value: 16 / 9 },
  { name: '16:10', value: 16 / 10 },
  { name: '4:3', value: 4 / 3 },
  { name: '1:1', value: 1 },
];

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
export const MAX_VISUALIZER_SCALE = 6;

/**
 * Visualizer padding in pixels
 * @constant {number}
 */
export const VISUALIZER_PADDING = 40;

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
