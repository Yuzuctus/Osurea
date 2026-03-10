import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initI18n, setLocale, t, getLocale } from '../i18n.js';
import { STORAGE_KEYS } from '../../constants/index.js';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

describe('i18n', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();

    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    Object.defineProperty(globalThis.navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });

    document.body.innerHTML = `
      <h1 data-i18n="app.title"></h1>
      <input data-i18n-placeholder="search.placeholder" />
      <button data-i18n-title="favorites.save"></button>
    `;
  });

  it('initializes from browser locale and translates page', async () => {
    await initI18n();

    expect(getLocale()).toBe('en');
    expect(document.querySelector('[data-i18n="app.title"]').textContent.length).toBeGreaterThan(0);
  });

  it('prefers stored locale over browser locale', async () => {
    localStorageMock.setItem(STORAGE_KEYS.LOCALE, 'fr');

    await initI18n();

    expect(getLocale()).toBe('fr');
  });

  it('changes locale, stores preference and dispatches locale-changed event', async () => {
    await initI18n();
    const listener = vi.fn();

    window.addEventListener('locale-changed', listener);
    await setLocale('es');

    expect(getLocale()).toBe('es');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEYS.LOCALE, 'es');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns key when translation is missing', async () => {
    await initI18n();

    expect(t('missing.translation.key')).toBe('missing.translation.key');
  });
});
