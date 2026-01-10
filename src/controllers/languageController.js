/**
 * Osu!rea - Language Controller
 * Handles language selection dropdown and locale switching
 * @module controllers/languageController
 */

import { setLocale, getLocale, translatePage } from '../modules/i18n.js';

/**
 * @typedef {Object} LanguageElements
 * @property {HTMLElement|null} langToggle - Language dropdown toggle button
 * @property {HTMLElement|null} langMenu - Language menu container
 * @property {HTMLElement|null} langDropdown - Language dropdown wrapper
 * @property {HTMLElement|null} currentLang - Current language display element
 */

/**
 * Select a specific language
 * @param {string} locale - Locale code (e.g., 'en', 'fr', 'es')
 * @param {LanguageElements} elements - DOM elements
 */
export async function selectLanguage(locale, elements) {
  await setLocale(locale);
  translatePage();
  updateLangDisplay(elements.currentLang);
  updateLangMenuActive();
  hideLangMenu(elements);
}

/**
 * Toggle language menu visibility
 * @param {LanguageElements} elements - DOM elements
 */
export function toggleLangMenu(elements) {
  const { langMenu, langToggle } = elements;
  if (langMenu && langToggle) {
    const isHidden = langMenu.classList.contains('hidden');
    langMenu.classList.toggle('hidden');
    langToggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  }
}

/**
 * Hide language menu
 * @param {LanguageElements} elements - DOM elements
 */
export function hideLangMenu(elements) {
  const { langMenu, langToggle } = elements;
  if (langMenu && langToggle) {
    langMenu.classList.add('hidden');
    langToggle.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Update active state in language menu
 */
export function updateLangMenuActive() {
  const currentLocale = getLocale();
  document.querySelectorAll('.lang-option').forEach(option => {
    const isActive = option.dataset.locale === currentLocale;
    option.classList.toggle('active', isActive);
  });
}

/**
 * Update language display element
 * @param {HTMLElement|null} currentLangEl - Current language display element
 */
export function updateLangDisplay(currentLangEl) {
  if (currentLangEl) {
    currentLangEl.textContent = getLocale().toUpperCase();
  }
}

/**
 * Setup language dropdown event listeners
 * @param {LanguageElements} elements - DOM elements
 */
export function setupLanguageDropdown(elements) {
  const { langToggle, langMenu, langDropdown, currentLang } = elements;

  if (!langToggle || !langMenu) return;

  // Toggle menu on button click
  langToggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleLangMenu(elements);
  });

  // Language option clicks
  document.querySelectorAll('.lang-option').forEach(option => {
    option.addEventListener('click', () => {
      selectLanguage(option.dataset.locale, elements);
    });
  });

  // Close on click outside
  document.addEventListener('click', e => {
    if (langDropdown && !langDropdown.contains(e.target)) {
      hideLangMenu(elements);
    }
  });

  // Close on escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideLangMenu(elements);
    }
  });

  // Set initial active state
  updateLangMenuActive();
  updateLangDisplay(currentLang);
}
