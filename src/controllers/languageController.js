/**
 * Osu!rea - Language Controller
 * EN / FR / ES toggles in the header
 * @module controllers/languageController
 */

import { setLocale, getLocale } from '../modules/i18n.js';

/**
 * Reflect the current locale on the toggles
 * @param {NodeListOf<HTMLButtonElement>} buttons
 */
export function updateLanguageToggles(buttons) {
  const current = getLocale();
  buttons.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.locale === current)));
}

/**
 * Wire the language toggles
 * @param {NodeListOf<HTMLButtonElement>} buttons
 * @param {Function} onChange - Called after the locale changed
 */
export function setupLanguageToggles(buttons, onChange) {
  updateLanguageToggles(buttons);
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.locale === getLocale()) return;
      await setLocale(btn.dataset.locale);
      updateLanguageToggles(buttons);
      onChange?.();
    });
  });
}
