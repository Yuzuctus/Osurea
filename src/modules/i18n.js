/**
 * Osu!rea - i18n Module
 * Simple internationalization with JSON locales
 * @module i18n
 */

import { STORAGE_KEYS, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../constants/index.js';
import { logWarn } from './logger.js';

/** @type {Object<string, Object>} - Cached locale data */
const locales = {};

let currentLocale = DEFAULT_LOCALE;
let translations = {};

/**
 * Load a specific locale using dynamic import for better code splitting
 * @param {string} locale - Locale code to load
 * @returns {Promise<Object>} - Loaded translations
 */
async function loadLocale(locale) {
  if (locales[locale]) {
    return locales[locale];
  }

  try {
    // Use dynamic import for better tree-shaking
    const module = await import(`../locales/${locale}.json`);
    locales[locale] = module.default;
    return module.default;
  } catch (error) {
    logWarn(`Failed to load locale ${locale}:`, error);
    // Fallback to English if available
    if (locale !== DEFAULT_LOCALE && locales[DEFAULT_LOCALE]) {
      return locales[DEFAULT_LOCALE];
    }
    return {};
  }
}

/**
 * Detect user's preferred language
 * @returns {string} - Locale code (en, fr, es)
 */
function detectLocale() {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEYS.LOCALE);
  if (stored && SUPPORTED_LOCALES.includes(stored)) {
    return stored;
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

  // Load only the active locale (and fallback English if different)
  translations = await loadLocale(currentLocale);

  // Also load English as fallback if not the current locale
  if (currentLocale !== DEFAULT_LOCALE) {
    await loadLocale(DEFAULT_LOCALE);
  }

  translatePage();

  // Update language selector
  const langSelect = document.querySelector('#lang-select');
  if (langSelect) langSelect.value = currentLocale;

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
    text = text.replace(new RegExp(`{{${param}}}`, 'g'), value);
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

  // Update html lang attribute
  document.documentElement.lang = currentLocale;
}

/**
 * Change current locale
 * @param {string} locale - Locale code
 */
export async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    logWarn(`Locale "${locale}" not supported`);
    return;
  }

  currentLocale = locale;
  translations = await loadLocale(locale);
  localStorage.setItem(STORAGE_KEYS.LOCALE, locale);
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

/**
 * Get all supported locales with labels
 * @returns {Array<{code: string, label: string}>}
 */
export function getSupportedLocales() {
  return [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
  ];
}

/**
 * Get available locale codes
 * @returns {Array<string>}
 */
export function getAvailableLocales() {
  return SUPPORTED_LOCALES;
}
