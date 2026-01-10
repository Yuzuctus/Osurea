/**
 * Osu!rea - Theme Controller
 * Handles dark/light theme switching and persistence
 * @module controllers/themeController
 */

import { getTheme, setTheme as saveTheme } from '../modules/storage.js';
import { icon } from '../modules/icons.js';

/**
 * @typedef {Object} ThemeElements
 * @property {HTMLElement|null} themeBtn - Theme toggle button
 */

/**
 * Initialize theme from storage and apply to document
 */
export function initTheme() {
  const theme = getTheme();
  document.documentElement.dataset.theme = theme;
}

/**
 * Get the current theme
 * @returns {'dark'|'light'} Current theme
 */
export function getCurrentTheme() {
  return getTheme();
}

/**
 * Update theme toggle button icon
 * @param {HTMLElement|null} themeBtn - Theme toggle button element
 */
export function updateThemeIcon(themeBtn) {
  if (themeBtn) {
    const theme = getTheme();
    themeBtn.innerHTML = icon(theme === 'dark' ? 'moon' : 'sun');
  }
}

/**
 * Toggle between dark and light theme
 * @param {HTMLElement|null} themeBtn - Theme toggle button element
 */
export function toggleTheme(themeBtn) {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  document.documentElement.dataset.theme = next;
  updateThemeIcon(themeBtn);
}

/**
 * Setup theme toggle event listener
 * @param {HTMLElement|null} themeBtn - Theme toggle button element
 */
export function setupThemeToggle(themeBtn) {
  if (!themeBtn) return;

  // Set initial icon
  updateThemeIcon(themeBtn);

  // Add click listener
  themeBtn.addEventListener('click', () => toggleTheme(themeBtn));
}
