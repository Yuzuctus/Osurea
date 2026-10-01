/**
 * Osu!rea - Tablet Selector Module
 * A trigger and a floating panel: search, models grouped by brand, custom
 * dimensions. Arrow keys move through the list, Escape closes it.
 * @module tablet-selector
 */

import { icon } from './icons.js';
import { t } from './i18n.js';
import { DEFAULT_TABLET } from '../constants/index.js';
import { escapeHtml, formatDecimal } from './utils.js';

/** @type {Array<{brand: string, model: string, width: number, height: number}>} */
let tablets = [];
/** @type {'loading'|'ready'|'error'} */
let loadState = 'loading';
let selectedTablet = null;
let onSelect = null;
let query = '';

// DOM elements
let root = null;
let triggerBtn = null;
let panel = null;
let searchInput = null;
let list = null;

/**
 * Load tablets data
 */
async function loadTablets() {
  loadState = 'loading';
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}tablets.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    tablets = Array.isArray(data) ? data : [];
    loadState = 'ready';
  } catch (e) {
    console.warn('Failed to load tablets:', e);
    tablets = [];
    loadState = 'error';
  }
}

/**
 * Filter tablets by search query (brand, model, or both: "wacom 472")
 * @param {string} q
 */
export function filterTablets(items, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter(tablet => {
    const haystack = `${tablet.brand} ${tablet.model}`.toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

function isSelected(tablet) {
  return Boolean(
    selectedTablet &&
    !selectedTablet.isCustom &&
    selectedTablet.brand === tablet.brand &&
    selectedTablet.model === tablet.model
  );
}

/**
 * Render the trigger label
 */
function renderTrigger() {
  if (!triggerBtn) return;
  const name = triggerBtn.querySelector('.os-tablet__name');
  const kicker = triggerBtn.querySelector('.ag-kicker');
  if (!selectedTablet) {
    kicker.textContent = t('tablet.title');
    name.textContent = t('tablet.select');
    return;
  }
  const size = `${formatDecimal(selectedTablet.width, 1)} × ${formatDecimal(selectedTablet.height, 1)} mm`;
  kicker.textContent = `${t('tablet.title')} · ${size}`;
  name.textContent = selectedTablet.isCustom
    ? t('tablet.custom')
    : `${selectedTablet.brand} ${selectedTablet.model}`;
  // The name is cut to one line: the full name stays in the tooltip
  triggerBtn.title = name.textContent;
}

/**
 * Render the list (grouped by brand), its empty and error states
 */
function renderList() {
  if (!list) return;

  if (loadState === 'error') {
    list.innerHTML = `
      <div class="ag-state ag-state--error" role="alert">
        <p class="ag-state__title">${t('tablet.loadErrorTitle')}</p>
        <p class="ag-state__body">${t('tablet.loadErrorBody')}</p>
        <div class="ag-state__actions">
          <button class="ag-button ag-button--sm" type="button" data-retry>${t('tablet.retry')}</button>
        </div>
      </div>`;
    return;
  }
  if (loadState === 'loading') {
    list.innerHTML = `<div class="ag-skeleton-group" aria-hidden="true">
      <span class="ag-skeleton"></span><span class="ag-skeleton"></span><span class="ag-skeleton"></span></div>`;
    return;
  }

  const filtered = filterTablets(tablets, query);
  if (filtered.length === 0) {
    list.innerHTML = `<div class="ag-state"><p class="ag-state__body">${escapeHtml(
      t('tablet.noResult', { query })
    )}</p></div>`;
    return;
  }

  const brands = [...new Set(filtered.map(tablet => tablet.brand))].sort((a, b) =>
    a.localeCompare(b)
  );
  list.innerHTML = brands
    .map(brand => {
      const models = filtered.filter(tablet => tablet.brand === brand);
      return `
        <div class="os-popover__group" role="group" aria-label="${escapeHtml(brand)}">
          <p class="ag-kicker" aria-hidden="true">${escapeHtml(brand)}</p>
          ${models
            .map(model => {
              const index = tablets.indexOf(model);
              return `<button class="os-option" type="button" data-index="${index}" ${
                isSelected(model) ? 'aria-current="true"' : ''
              }>
                <span>${escapeHtml(model.model)}</span>
                <span class="os-option__size">${formatDecimal(model.width, 1)} × ${formatDecimal(model.height, 1)} mm</span>
              </button>`;
            })
            .join('')}
        </div>`;
    })
    .join('');
}

/**
 * Select a tablet and close the panel
 */
function selectTablet(tablet) {
  selectedTablet = tablet;
  renderTrigger();
  closePanel(true);
  onSelect?.(tablet);
}

/** Where the settings column scrolls on its own (see osurea.css, one screen) */
const oneScreen = window.matchMedia('(min-width: 1280px) and (min-height: 560px)');

/**
 * In the one-screen layout the settings column can scroll and would clip the
 * panel: it is then placed against the window, under the trigger.
 */
function placePanel() {
  if (!oneScreen.matches) {
    panel.classList.remove('is-fixed');
    panel.style.removeProperty('top');
    panel.style.removeProperty('right');
    panel.style.removeProperty('max-height');
    return;
  }
  const rect = triggerBtn.getBoundingClientRect();
  const top = rect.bottom + 4;
  panel.classList.add('is-fixed');
  panel.style.top = `${top}px`;
  panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
  panel.style.maxHeight = `${Math.max(240, window.innerHeight - top - 16)}px`;
}

function openPanel() {
  panel.hidden = false;
  triggerBtn.setAttribute('aria-expanded', 'true');
  renderList();
  placePanel();
  // On a phone the panel opens under a sticky header: bring it into view.
  if (!oneScreen.matches) panel.scrollIntoView({ block: 'nearest' });
  searchInput.focus();
}

/**
 * @param {boolean} [returnFocus=false]
 */
function closePanel(returnFocus = false) {
  if (panel.hidden) return;
  panel.hidden = true;
  triggerBtn.setAttribute('aria-expanded', 'false');
  if (returnFocus) triggerBtn.focus();
}

/**
 * Arrow keys move between options and the search field
 */
function handleListKeys(e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const options = [...list.querySelectorAll('.os-option')];
  if (options.length === 0) return;
  e.preventDefault();
  const index = options.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    options[Math.min(index + 1, options.length - 1)].focus();
  } else if (index <= 0) {
    searchInput.focus();
  } else {
    options[index - 1].focus();
  }
}

/**
 * Initialize tablet selector
 * @param {HTMLElement} container - Container element
 * @param {Function} onChange - Callback when tablet changes
 */
export async function initTabletSelector(container, onChange = null) {
  onSelect = onChange;
  root = container;

  root.innerHTML = `
    <button class="os-tablet__trigger" type="button" id="tablet-trigger" aria-expanded="false" aria-controls="tablet-panel">
      <span class="ag-kicker"></span>
      <span class="os-tablet__name"></span>
      ${icon('chevronDown')}
    </button>
    <div class="os-popover" id="tablet-panel" hidden>
      <div class="os-popover__search">
        <label class="ag-field">
          <span class="ag-visually-hidden" data-i18n="tablet.search">${t('tablet.search')}</span>
          <input class="ag-input" type="search" autocomplete="off" spellcheck="false"
            placeholder="${t('tablet.searchPlaceholder')}" data-i18n-placeholder="tablet.searchPlaceholder" />
        </label>
      </div>
      <div class="os-popover__list"></div>
      <div class="os-popover__foot">
        <button class="ag-button ag-button--sm ag-button--quiet" type="button" data-custom>
          ${icon('plus')}<span data-i18n="tablet.custom">${t('tablet.custom')}</span>
        </button>
      </div>
    </div>
  `;

  triggerBtn = root.querySelector('#tablet-trigger');
  panel = root.querySelector('#tablet-panel');
  // Focusable, so a click on a brand heading or a gap keeps the focus inside
  panel.tabIndex = -1;
  searchInput = panel.querySelector('input');
  list = panel.querySelector('.os-popover__list');
  renderTrigger();

  triggerBtn.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));

  searchInput.addEventListener('input', () => {
    query = searchInput.value.trim();
    renderList();
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list.querySelector('.os-option')?.focus();
    } else if (e.key === 'Enter') {
      // Enter picks the only match
      const options = list.querySelectorAll('.os-option');
      if (options.length === 1) {
        e.preventDefault();
        options[0].click();
      }
    }
  });

  list.addEventListener('keydown', handleListKeys);
  list.addEventListener('click', async e => {
    const option = e.target.closest('.os-option');
    if (option) {
      const tablet = tablets[Number(option.dataset.index)];
      if (tablet) selectTablet({ ...tablet, isCustom: false });
      return;
    }
    if (e.target.closest('[data-retry]')) {
      renderList();
      await loadTablets();
      renderList();
    }
  });

  panel.querySelector('[data-custom]').addEventListener('click', () => {
    const base = selectedTablet ?? DEFAULT_TABLET;
    selectTablet({
      brand: 'Custom',
      model: 'Custom',
      width: base.width,
      height: base.height,
      isCustom: true,
    });
  });

  root.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.stopPropagation();
      closePanel(true);
    }
  });
  // Close when focus or a press leaves the selector
  root.addEventListener('focusout', e => {
    if (!root.contains(e.relatedTarget)) closePanel();
  });
  document.addEventListener('pointerdown', e => {
    if (!root.contains(e.target)) closePanel();
  });
  // A panel placed against the window would drift from its trigger
  window.addEventListener('resize', () => closePanel());
  document.addEventListener(
    'scroll',
    e => {
      if (panel.classList.contains('is-fixed') && !panel.contains(e.target)) closePanel();
    },
    true
  );

  await loadTablets();
  renderList();
}

/**
 * Set current tablet (from preferences, favorites, pro players)
 * @param {Object} tablet
 */
export function setCurrentTablet(tablet) {
  selectedTablet = tablet ? { ...tablet } : null;
  renderTrigger();
  if (panel && !panel.hidden) renderList();
}

/**
 * Re-render texts after a language change
 */
export function refreshTabletSelector() {
  renderTrigger();
  if (panel && !panel.hidden) renderList();
}
