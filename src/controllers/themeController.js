/**
 * Osu!rea - Theme Controller
 * Agrume convention: <html data-theme> only when the user chose a theme,
 * otherwise the system preference decides. public/theme-init.js applies the
 * stored choice before the first paint.
 * @module controllers/themeController
 */

import { getTheme, setTheme } from '../modules/storage.js';
import { t } from '../modules/i18n.js';

/** Paper colour of each theme, for <meta name="theme-color"> */
const THEME_COLORS = { light: '#f3f6ea', dark: '#131c17' };

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * The theme currently shown, chosen or inherited from the system
 * @returns {'dark'|'light'}
 */
export function getEffectiveTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return darkQuery.matches ? 'dark' : 'light';
}

/**
 * Point the browser chrome colour at the chosen theme
 * @param {'dark'|'light'|null} theme
 */
function updateThemeColor(theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLORS[theme ?? scheme];
  });
}

/**
 * Label the toggle with the theme it switches to
 * @param {HTMLElement|null} button
 */
export function updateThemeToggle(button) {
  if (!button) return;
  const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
  button.textContent = t(next === 'dark' ? 'theme.dark' : 'theme.light');
  button.setAttribute('aria-label', t(next === 'dark' ? 'theme.toDark' : 'theme.toLight'));
}

/**
 * Wire the theme toggle
 * @param {HTMLElement|null} button
 */
export function setupThemeToggle(button) {
  if (!button) return;
  updateThemeColor(getTheme());
  updateThemeToggle(button);

  button.addEventListener('click', () => {
    const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    updateThemeColor(next);
    updateThemeToggle(button);
  });

  // Without an explicit choice, follow the system live
  darkQuery.addEventListener('change', () => updateThemeToggle(button));
}
