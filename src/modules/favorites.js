/**
 * Osu!rea - Favorites Module
 * Manage saved area configurations
 * @module favorites
 */

import { icon } from './icons.js';
import { t } from './i18n.js';
import { getFavorites, addFavorite, removeFavorite, updateFavorite } from './storage.js';
import { confirmDelete, showEditFavoriteModal, showSaveFavoriteModal } from './modal.js';
import { escapeHtml } from './utils.js';
import { generatePreview } from './preview.js';

/** @type {HTMLElement|null} */
let container = null;

/** @type {Function|null} */
let onSelect = null;

/** @type {'date'|'name'|'tablet'|'area'} */
let currentSort = 'date';

/** @type {'asc'|'desc'} */
let sortDirection = 'desc';

/**
 * Sort favorites
 */
function sortFavorites(favorites) {
  const sorted = [...favorites];

  switch (currentSort) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'date':
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'tablet':
      sorted.sort((a, b) =>
        `${a.tablet.brand} ${a.tablet.model}`.localeCompare(`${b.tablet.brand} ${b.tablet.model}`)
      );
      break;
    case 'area':
      sorted.sort((a, b) => b.area.width * b.area.height - a.area.width * a.area.height);
      break;
  }

  if (sortDirection === 'desc' && currentSort !== 'date') {
    sorted.reverse();
  }

  return sorted;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Render a single favorite card
 */
function renderFavoriteCard(favorite) {
  const commentHtml = favorite.comment 
    ? `<div class="favorite-comment" title="${escapeHtml(favorite.comment)}">${escapeHtml(favorite.comment)}</div>` 
    : '';
  
  return `
    <div class="favorite-card" data-id="${escapeHtml(favorite.id)}">
      <div class="favorite-preview-wrapper">
        ${generatePreview(favorite.tablet, favorite.area)}
      </div>
      <div class="favorite-info">
        <h3 class="favorite-name">${escapeHtml(favorite.name)}</h3>
        ${commentHtml}
        <div class="favorite-details">
          <span class="favorite-tablet">${escapeHtml(favorite.tablet.brand)} ${escapeHtml(
            favorite.tablet.model
          )}</span>
          <span class="favorite-area">${favorite.area.width.toFixed(
            1
          )} × ${favorite.area.height.toFixed(1)} mm</span>
        </div>
        <div class="favorite-date">${formatDate(favorite.createdAt)}</div>
      </div>
      <div class="favorite-actions">
        <button class="favorite-load" title="${t('favorites.load')}">
          ${icon('play')}
        </button>
        <button class="favorite-edit" title="${t('favorites.edit')}">
          ${icon('edit')}
        </button>
        <button class="favorite-delete delete" title="${t('favorites.delete')}">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

/**
 * Render favorites list
 */
export function renderFavorites() {
  if (!container) return;

  const favorites = getFavorites();
  const sorted = sortFavorites(favorites);

  const headerHtml = `
    <div class="favorites-header">
      <h2 class="favorites-title" data-i18n="favorites.title">${t('favorites.title')}</h2>
      <div class="favorites-controls">
        <div class="favorites-sort-wrapper">
          <select class="favorites-sort" id="favorites-sort">
            <option value="date" ${
              currentSort === 'date' ? 'selected' : ''
            }>${t('favorites.sortByDate')}</option>
            <option value="name" ${
              currentSort === 'name' ? 'selected' : ''
            }>${t('favorites.sortByName')}</option>
            <option value="tablet" ${
              currentSort === 'tablet' ? 'selected' : ''
            }>${t('favorites.sortByTablet')}</option>
            <option value="area" ${
              currentSort === 'area' ? 'selected' : ''
            }>${t('favorites.sortByArea')}</option>
          </select>
          <button class="sort-direction" id="sort-direction" title="Toggle direction">
            ${sortDirection === 'desc' ? icon('sortDesc') : icon('sortAsc')}
          </button>
        </div>
      </div>
    </div>
  `;

  let contentHtml;
  if (sorted.length === 0) {
    contentHtml = `
      <div class="favorites-empty">
        ${icon('heart')}
        <p data-i18n="favorites.empty">${t('favorites.empty')}</p>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="favorites-list">
        ${sorted.map(f => renderFavoriteCard(f)).join('')}
      </div>
    `;
  }

  container.innerHTML = headerHtml + contentHtml;

  setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const sortSelect = container.querySelector('#favorites-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      currentSort = e.target.value;
      renderFavorites();
    });
  }

  const sortBtn = container.querySelector('#sort-direction');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      renderFavorites();
    });
  }

  container.querySelectorAll('.favorite-card').forEach(card => {
    const { id } = card.dataset;
    const favorite = getFavorites().find(f => f.id === id);

    card.querySelector('.favorite-load')?.addEventListener('click', e => {
      e.stopPropagation();
      if (onSelect && favorite) {
        onSelect(favorite);
      }
    });

    card.querySelector('.favorite-edit')?.addEventListener('click', e => {
      e.stopPropagation();
      editFavorite(id);
    });

    card.querySelector('.favorite-delete')?.addEventListener('click', e => {
      e.stopPropagation();
      deleteFavorite(id);
    });

    card.addEventListener('click', () => {
      if (onSelect && favorite) {
        onSelect(favorite);
      }
    });
  });
}

/**
 * Edit favorite with full configuration modal
 */
async function editFavorite(id) {
  const favorite = getFavorites().find(f => f.id === id);
  if (!favorite) return;

  const result = await showEditFavoriteModal(favorite);

  if (result) {
    const updates = {
      name: result.name?.trim() || favorite.name,
      comment: result.comment?.trim() ?? favorite.comment ?? '',
      area: {
        ...favorite.area,
        width: result.width || favorite.area.width,
        height: result.height || favorite.area.height,
        x: result.x || favorite.area.x,
        y: result.y || favorite.area.y,
        radius: result.radius ?? favorite.area.radius,
      },
    };

    updateFavorite(id, updates);
    renderFavorites();

    window.dispatchEvent(
      new CustomEvent('favorite-updated', {
        detail: { id, ...updates },
      })
    );
  }
}

/**
 * Delete favorite with confirmation
 */
async function deleteFavorite(id) {
  const favorite = getFavorites().find(f => f.id === id);
  if (!favorite) return;

  const confirmed = await confirmDelete(
    t('favorites.deleteConfirm', { name: favorite.name }),
    t('favorites.delete')
  );

  if (confirmed) {
    removeFavorite(id);
    renderFavorites();
    window.dispatchEvent(
      new CustomEvent('favorite-deleted', {
        detail: { id },
      })
    );
  }
}

/**
 * Save current configuration as favorite
 */
export async function saveCurrentAsFavorite(tablet, area) {
  const defaultName = `${tablet.brand} ${tablet.model} - ${area.width.toFixed(
    0
  )}×${area.height.toFixed(0)}`;
  
  const result = await showSaveFavoriteModal(defaultName);

  if (!result || !result.name?.trim()) return null;

  const favorite = addFavorite({
    name: result.name.trim(),
    comment: result.comment?.trim() || '',
    tablet,
    area,
    createdAt: new Date().toISOString(),
  });

  renderFavorites();

  window.dispatchEvent(
    new CustomEvent('favorite-saved', {
      detail: favorite,
    })
  );

  return favorite;
}

/**
 * Initialize favorites module
 */
export function initFavorites(containerEl, onSelectFavorite = null) {
  container = containerEl;
  onSelect = onSelectFavorite;
  renderFavorites();
}

/**
 * Refresh favorites display
 */
export function refreshFavorites() {
  renderFavorites();
}
