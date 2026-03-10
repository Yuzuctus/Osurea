/**
 * Osu!rea - Tablet Selector Module
 * Dropdown for selecting tablet models
 */

import { icon } from './icons.js';
import { t } from './i18n.js';
import { logError } from './logger.js';
import { DEFAULT_TABLET } from '../constants/index.js';
import { escapeHtml } from './utils.js';

let tablets = [];
let selectedBrand = null;
let selectedTablet = null;
let isCustomMode = false;
let onSelect = null;

// DOM elements
let triggerBtn = null;
let dropdown = null;
let searchInput = null;
let brandsList = null;
let modelsList = null;
let customBtn = null;

/**
 * Load tablets data
 */
async function loadTablets() {
  try {
    const response = await fetch('/tablets.json');
    if (!response.ok) {
      throw new Error(`Failed to load tablets: ${response.status}`);
    }
    tablets = await response.json();
    return tablets;
  } catch (e) {
    logError('Failed to load tablets:', e);
    return [];
  }
}

/**
 * Get models for a brand
 * @param {string} brand - Brand name
 * @returns {Array} - Array of tablet models
 */
function getModels(brand) {
  return tablets.filter(tablet => tablet.brand === brand);
}

/**
 * Filter tablets by search query
 * @param {string} query - Search query
 * @returns {Array} - Filtered tablets
 */
function filterTablets(query) {
  if (!query) return tablets;

  const lowerQuery = query.toLowerCase();
  return tablets.filter(
    tablet =>
      tablet.brand.toLowerCase().includes(lowerQuery) ||
      tablet.model.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Render brands list
 * @param {Array} [filteredTablets=tablets] - Filtered tablets array
 */
function renderBrands(filteredTablets = tablets) {
  const brands = [...new Set(filteredTablets.map(tablet => tablet.brand))].sort();

  brandsList.innerHTML = brands
    .map(
      brand => `
    <button 
      class="tablet-brand-item ${brand === selectedBrand ? 'active' : ''}" 
      data-brand="${escapeHtml(brand)}"
    >
      ${escapeHtml(brand)}
      <span class="brand-count">${getModels(brand).length}</span>
    </button>
  `
    )
    .join('');

  // Add click handlers
  brandsList.querySelectorAll('.tablet-brand-item').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // Prevent dropdown from closing
      selectedBrand = btn.dataset.brand;
      renderBrands(filteredTablets);
      renderModels(selectedBrand);
    });
  });

  // Auto-select first brand if none selected
  if (!selectedBrand && brands.length > 0) {
    selectedBrand = brands[0];
    renderBrands(filteredTablets);
    renderModels(selectedBrand);
  }
}

/**
 * Render models list
 */
function renderModels(brand) {
  const models = getModels(brand);

  if (!brand || models.length === 0) {
    modelsList.innerHTML = `<div class="models-empty">${t('tablet.selectTablet')}</div>`;
    return;
  }

  modelsList.innerHTML = models
    .map(
      model => `
    <button 
      class="tablet-model-item ${selectedTablet?.model === model.model ? 'active' : ''}" 
      data-model="${escapeHtml(model.model)}"
      data-width="${model.width}"
      data-height="${model.height}"
    >
      <span class="model-name">${escapeHtml(model.model)}</span>
      <span class="model-size">${model.width} × ${model.height}</span>
    </button>
  `
    )
    .join('');

  // Add click handlers
  modelsList.querySelectorAll('.tablet-model-item').forEach(btn => {
    btn.addEventListener('click', () => {
      selectTablet({
        brand,
        model: btn.dataset.model,
        width: parseFloat(btn.dataset.width),
        height: parseFloat(btn.dataset.height),
        isCustom: false,
      });
    });
  });
}

/**
 * Select a tablet
 */
function selectTablet(tablet) {
  selectedTablet = tablet;
  isCustomMode = tablet.isCustom;

  // Update trigger text
  if (triggerBtn) {
    const text = triggerBtn.querySelector('.select-text');
    if (text) {
      text.textContent = tablet.isCustom
        ? t('tablet.customDimensions')
        : `${tablet.brand} ${tablet.model}`;
    }
  }

  // Close dropdown
  hideDropdown();

  // Notify
  if (onSelect) {
    onSelect(tablet);
  }

  window.dispatchEvent(
    new CustomEvent('tablet-changed', {
      detail: tablet,
    })
  );
}

/**
 * Show dropdown
 */
function showDropdown() {
  dropdown.classList.remove('hidden');
  triggerBtn.classList.add('open');
  searchInput?.focus();
}

/**
 * Hide dropdown
 */
function hideDropdown() {
  dropdown.classList.add('hidden');
  triggerBtn.classList.remove('open');
}

/**
 * Toggle dropdown
 */
function toggleDropdown() {
  if (dropdown.classList.contains('hidden')) {
    showDropdown();
  } else {
    hideDropdown();
  }
}

/**
 * Handle search input
 */
function handleSearch(e) {
  const query = e.target.value.trim();
  const filtered = filterTablets(query);

  // Reset brand selection when searching
  if (query) {
    selectedBrand = null;
  }

  renderBrands(filtered);

  // If searching, show all matching models
  if (query && filtered.length > 0) {
    renderSearchResults(filtered);
  }
}

/**
 * Render search results (all matching models)
 */
function renderSearchResults(filtered) {
  modelsList.innerHTML = filtered
    .map(
      model => `
    <button 
      class="tablet-model-item" 
      data-brand="${model.brand}"
      data-model="${model.model}"
      data-width="${model.width}"
      data-height="${model.height}"
    >
      <span class="model-brand">${model.brand}</span>
      <span class="model-name">${model.model}</span>
      <span class="model-size">${model.width} × ${model.height}</span>
    </button>
  `
    )
    .join('');

  modelsList.querySelectorAll('.tablet-model-item').forEach(btn => {
    btn.addEventListener('click', () => {
      selectTablet({
        brand: btn.dataset.brand,
        model: btn.dataset.model,
        width: parseFloat(btn.dataset.width),
        height: parseFloat(btn.dataset.height),
        isCustom: false,
      });
    });
  });
}

/**
 * Enable custom mode
 */
function enableCustomMode() {
  selectTablet({
    brand: 'Custom',
    model: 'Custom',
    width: DEFAULT_TABLET.width,
    height: DEFAULT_TABLET.height,
    isCustom: true,
  });
}

/**
 * Initialize tablet selector
 * @param {HTMLElement} container - Container element
 * @param {Function} onChange - Callback when tablet changes
 */
export async function initTabletSelector(container, onChange = null) {
  onSelect = onChange;

  // Create structure
  container.innerHTML = `
    <button class="select-trigger" id="tablet-trigger">
      <span class="select-text" data-i18n="tablet.selectTablet">${t('tablet.selectTablet')}</span>
      ${icon('chevronDown')}
    </button>
    <div class="dropdown hidden" id="tablet-dropdown">
      <div class="dropdown-search">
        <div class="search-input-wrapper">
          ${icon('search')}
          <input 
            type="text" 
            class="search-input" 
            placeholder="${t('tablet.searchPlaceholder')}"
            data-i18n-placeholder="tablet.searchPlaceholder"
          >
        </div>
      </div>
      <div class="dropdown-body">
        <div class="brands-list" id="brands-list"></div>
        <div class="models-list" id="models-list"></div>
      </div>
      <div class="dropdown-footer">
        <button class="custom-btn" id="custom-tablet-btn">
          ${icon('plus')}
          <span data-i18n="tablet.customDimensions">${t('tablet.customDimensions')}</span>
        </button>
      </div>
    </div>
  `;

  // Get elements
  triggerBtn = container.querySelector('#tablet-trigger');
  dropdown = container.querySelector('#tablet-dropdown');
  searchInput = container.querySelector('.search-input');
  brandsList = container.querySelector('#brands-list');
  modelsList = container.querySelector('#models-list');
  customBtn = container.querySelector('#custom-tablet-btn');

  // Load tablets
  await loadTablets();

  // Render initial state
  renderBrands();

  // Event listeners
  triggerBtn.addEventListener('click', toggleDropdown);
  searchInput.addEventListener('input', handleSearch);
  customBtn.addEventListener('click', enableCustomMode);

  // Close on click outside
  document.addEventListener('click', e => {
    if (!container.contains(e.target)) {
      hideDropdown();
    }
  });

  // Close on escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hideDropdown();
    }
  });
}

/**
 * Set current tablet (from preferences)
 */
export function setCurrentTablet(tablet) {
  selectedTablet = tablet;

  if (tablet) {
    selectedBrand = tablet.brand;

    if (triggerBtn) {
      const text = triggerBtn.querySelector('.select-text');
      if (text) {
        text.textContent = tablet.isCustom
          ? t('tablet.customDimensions')
          : `${tablet.brand} ${tablet.model}`;
      }
    }
  }
}

/**
 * Get current tablet
 */
export function getCurrentTablet() {
  return selectedTablet;
}

/**
 * Check if custom mode is active
 * @returns {boolean}
 */
export function isCustom() {
  return isCustomMode;
}
