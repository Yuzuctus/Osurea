/**
 * Osu!rea - Theme Controller (Yuzuctus Design System v3 — Négatif / Positif)
 * Synchronises <html data-film="negative|positive"> and <html data-theme="dark|light">,
 * supports circular View Transition wave and keyboard shortcut 'N'.
 * @module controllers/themeController
 */

import { getTheme, setTheme } from '../modules/storage.js';
import { t } from '../modules/i18n.js';

/** Ground colour of each theme, for <meta name="theme-color"> */
const THEME_COLORS = { light: '#f5eee0', dark: '#0b0f0e' };

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * The theme currently shown, chosen or inherited from the system
 * @returns {'dark'|'light'}
 */
export function getEffectiveTheme() {
  const film = document.documentElement.dataset.film;
  if (film === 'positive') return 'light';
  if (film === 'negative') return 'dark';
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
    const scheme = meta.media && meta.media.includes('light') ? 'light' : 'dark';
    meta.content = THEME_COLORS[theme ?? scheme];
  });
}

/**
 * Label the FilmSwitch with the current active mode (Négatif / Positif)
 * @param {HTMLElement|null} button
 */
export function updateThemeToggle(button) {
  if (!button) return;
  const current = getEffectiveTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  const labelText = t(current === 'dark' ? 'theme.dark' : 'theme.light');
  const labelEl = button.querySelector('#theme-toggle-label');
  if (labelEl) {
    labelEl.textContent = labelText;
  } else {
    button.textContent = labelText;
  }
  const ariaText = t(next === 'dark' ? 'theme.toDark' : 'theme.toLight');
  button.setAttribute('aria-label', ariaText);
  button.setAttribute('title', ariaText);
}

/**
 * Apply theme change with circular View Transition wave
 * @param {'dark'|'light'} next
 * @param {HTMLElement|null} button
 * @param {{x: number, y: number}} [origin]
 */
function triggerFilmSwitch(next, button, origin) {
  const film = next === 'light' ? 'positive' : 'negative';

  const apply = () => {
    document.documentElement.dataset.theme = next;
    document.documentElement.dataset.film = film;
    setTheme(next);
    try {
      localStorage.setItem('yuzuctus-film', film);
    } catch {
      /* ignore */
    }
    updateThemeColor(next);
    updateThemeToggle(button);
  };

  if (!document.startViewTransition) {
    apply();
    return;
  }

  const x = origin?.x ?? window.innerWidth - 96;
  const y = origin?.y ?? 32;
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = document.startViewTransition(apply);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 560,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    })
    .catch(() => {
      /* ignore aborted view transition */
    });
}

/**
 * Wire the theme toggle and shortcut 'N'
 * @param {HTMLElement|null} button
 */
export function setupThemeToggle(button) {
  if (!button) return;
  const current = getEffectiveTheme();
  document.documentElement.dataset.theme = current;
  document.documentElement.dataset.film = current === 'light' ? 'positive' : 'negative';
  updateThemeColor(getTheme() ?? current);
  updateThemeToggle(button);

  button.addEventListener('click', () => {
    const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    const rect = button.getBoundingClientRect();
    triggerFilmSwitch(next, button, {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    });
  });

  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
      const rect = button.getBoundingClientRect();
      triggerFilmSwitch(next, button, {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      });
    }
  });

  darkQuery.addEventListener('change', () => updateThemeToggle(button));
}
