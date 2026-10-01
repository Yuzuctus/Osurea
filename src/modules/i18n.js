/**
 * Osu!rea - i18n Module
 * Simple internationalization with JSON locales
 * @module i18n
 */

import { STORAGE_KEYS, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../constants/index.js';

// The three locales ship with the app (about 4 kB gzipped together): a
// separate request would show the English page first to everyone else.
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';

/** @type {Object<string, Object>} - Locale data */
const locales = { en, fr, es };

let currentLocale = DEFAULT_LOCALE;
let translations = {};

/**
 * Get a locale's translations (English when unknown)
 * @param {string} locale - Locale code
 * @returns {Promise<Object>} - Translations
 */
async function loadLocale(locale) {
  return locales[locale] ?? locales[DEFAULT_LOCALE];
}

/**
 * Detect user's preferred language
 * @returns {string} - Locale code (en, fr, es)
 */
function detectLocale() {
  // Check localStorage first
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOCALE);
    if (stored && SUPPORTED_LOCALES.includes(stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable: fall through to the browser language
  }

  // Check browser language
  const browserLang = navigator.language?.split('-')[0];
  if (browserLang && SUPPORTED_LOCALES.includes(browserLang)) {
    return browserLang;
  }

  return DEFAULT_LOCALE;
}

/**
 * Initialize i18n system
 */
export async function initI18n() {
  currentLocale = detectLocale();

  translations = await loadLocale(currentLocale);

  translatePage();

  return currentLocale;
}

/**
 * Get translation for a key
 * @param {string} key - Translation key (e.g., "app.title")
 * @param {object} params - Optional parameters for interpolation
 * @returns {string} - Translated string
 */
export function t(key, params = {}) {
  if (!translations) return key;
  let text = translations[key] || locales[DEFAULT_LOCALE]?.[key] || key;

  // Simple interpolation: {{name}} -> value
  Object.entries(params).forEach(([param, value]) => {
    text = text.split(`{{${param}}}`).join(String(value));
  });

  return text;
}

/**
 * Translate all elements with data-i18n attribute
 */
export function translatePage() {
  // Translate text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });

  // Translate titles/tooltips
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
    }
  });

  // Translate accessible names
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) {
      el.setAttribute('aria-label', t(key));
    }
  });

  // Update html lang attribute and document title
  document.documentElement.lang = currentLocale;
  document.title = `Osu!rea · ${t('app.title')}`;
}

/**
 * Change current locale
 * @param {string} locale - Locale code
 */
export async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    console.warn(`Locale "${locale}" not supported`);
    return;
  }

  currentLocale = locale;
  translations = await loadLocale(locale);
  try {
    localStorage.setItem(STORAGE_KEYS.LOCALE, locale);
  } catch {
    // Storage unavailable: the choice lasts for this visit
  }
  translatePage();

  // Dispatch event for components that need to react
  window.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale } }));
}

/**
 * Get current locale
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}
