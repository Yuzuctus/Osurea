/**
 * Osu!rea - Favorites Module
 * Saved area configurations, rendered as an Agrume collection: the whole
 * row loads the favorite, Edit and Delete stay sibling buttons.
 * @module favorites
 */

import { icon } from './icons.js';
import { t, getLocale } from './i18n.js';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  updateFavorite,
  normalizeArea,
} from './storage.js';
import { announce, confirmDelete, showEditFavoriteModal, showSaveFavoriteModal } from './modal.js';
import { calculateRatioString, clamp, clampCentre, escapeHtml, formatDecimal } from './utils.js';
import { generatePreview } from './preview.js';

/** @type {HTMLElement|null} */
let container = null;

/** @type {Function|null} */
let onSelect = null;

/** @type {'date'|'name'|'tablet'|'area'} */
let currentSort = 'date';

/** @type {'asc'|'desc'} */
let sortDirection = 'desc';

/** Natural direction of each sort: newest, A→Z, A→Z, largest. */
const DEFAULT_DIRECTION = { date: 'desc', name: 'asc', tablet: 'asc', area: 'desc' };

const COMPARATORS = {
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }),
  date: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  tablet: (a, b) =>
    `${a.tablet.brand} ${a.tablet.model}`.localeCompare(`${b.tablet.brand} ${b.tablet.model}`),
  area: (a, b) => a.area.width * a.area.height - b.area.width * b.area.height,
};

/**
 * Sort favorites
 * @param {Array} favorites
 * @param {'date'|'name'|'tablet'|'area'} sort
 * @param {'asc'|'desc'} direction
 * @returns {Array}
 */
export function sortFavorites(favorites, sort = currentSort, direction = sortDirection) {
  const compare = COMPARATORS[sort] ?? COMPARATORS.date;
  const sorted = [...favorites].sort(compare);
  return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Format date for display, in the interface language
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(getLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Render a single favorite row
 */
function renderFavoriteRow(favorite) {
  const { tablet, area } = favorite;
  const name = escapeHtml(favorite.name);
  const meta = [
    escapeHtml(tablet.isCustom ? t('tablet.custom') : `${tablet.brand} ${tablet.model}`),
    `${formatDecimal(area.width, 1)} × ${formatDecimal(area.height, 1)} mm`,
    calculateRatioString(area.width, area.height),
    formatDate(favorite.createdAt),
  ].filter(Boolean);

  return `
    <li class="ag-record" data-id="${escapeHtml(favorite.id)}">
      <div class="ag-record__copy">
        <h3 class="ag-record__title">${name}</h3>
        <p class="ag-record__meta">${meta.join(' · ')}</p>
        ${
          favorite.comment
            ? `<p class="ag-record__meta os-record__comment">${escapeHtml(favorite.comment)}</p>`
            : ''
        }
      </div>
      <button class="ag-record__primary" type="button" data-action="load"
        aria-label="${escapeHtml(t('favorites.load', { name: favorite.name }))}"></button>
      <div class="ag-record__actions">
        <button class="ag-button ag-button--sm ag-button--quiet" type="button" data-action="edit">
          ${t('favorites.edit')}
        </button>
        <button class="ag-button ag-button--sm ag-button--danger" type="button" data-action="delete">
          ${t('favorites.delete')}
        </button>
      </div>
      <div class="ag-record__media">${generatePreview(tablet, area)}</div>
    </li>
  `;
}

/**
 * Render favorites list
 */
export function renderFavorites() {
  if (!container) return;

  const favorites = getFavorites();
  const sorted = sortFavorites(favorites);
  const options = ['date', 'name', 'tablet', 'area']
    .map(
      key =>
        `<option value="${key}" ${currentSort === key ? 'selected' : ''}>${t(
          `favorites.sortBy${key[0].toUpperCase()}${key.slice(1)}`
        )}</option>`
    )
    .join('');
  const directionLabel = t(sortDirection === 'desc' ? 'favorites.sortDesc' : 'favorites.sortAsc');

  const sortHtml =
    favorites.length > 1
      ? `<div class="ag-section__actions os-favorites__sort">
          <label class="ag-field__label" for="favorites-sort">${t('favorites.sort')}</label>
          <select class="ag-select" id="favorites-sort">${options}</select>
          <button class="ag-button ag-button--icon ag-button--quiet" type="button" id="sort-direction"
            aria-label="${directionLabel}" title="${directionLabel}">
            ${icon(sortDirection === 'desc' ? 'sortDesc' : 'sortAsc')}
          </button>
        </div>`
      : '';

  const contentHtml =
    sorted.length === 0
      ? `<div class="ag-state ag-state--block">
          <p class="ag-state__title">${t('favorites.emptyTitle')}</p>
          <p class="ag-state__body">${t('favorites.emptyBody')}</p>
        </div>`
      : `<ol class="ag-records os-records">${sorted.map(renderFavoriteRow).join('')}</ol>`;

  container.innerHTML = `
    <div class="ag-section__head">
      <div class="ag-section__heading">
        <p class="ag-kicker">${t('favorites.kicker')}</p>
        <div class="ag-section__titleline">
          <h2 class="ag-section__title" id="favorites-title">${t('favorites.title')}</h2>
          ${favorites.length ? `<span class="ag-meta ag-num">${favorites.length}</span>` : ''}
        </div>
      </div>
      ${sortHtml}
    </div>
    ${contentHtml}
  `;
}

/**
 * Edit favorite: name, comment and area, kept inside its tablet
 */
async function editFavorite(id) {
  const favorite = getFavorites().find(f => f.id === id);
  if (!favorite) return;

  const result = await showEditFavoriteModal(favorite);
  if (!result) return;

  const { tablet } = favorite;
  const area = normalizeArea({ ...favorite.area, ...result });
  area.width = clamp(area.width, 1, tablet.width);
  area.height = clamp(area.height, 1, tablet.height);
  area.radius = clamp(Math.round(area.radius), 0, 100);
  area.rotation = clamp(Math.round(area.rotation), -180, 180);
  Object.assign(area, clampCentre(area, tablet));

  updateFavorite(id, {
    name: result.name?.trim() || favorite.name,
    comment: (result.comment ?? '').trim(),
    area,
  });
  renderFavorites();
  focusRow(id, 'edit');
}

/**
 * Delete favorite with confirmation
 */
async function deleteFavorite(id) {
  const favorite = getFavorites().find(f => f.id === id);
  if (!favorite) return;

  const confirmed = await confirmDelete(
    t('favorites.deleteConfirm', { name: favorite.name }),
    t('favorites.deleteTitle')
  );
  if (!confirmed) return;

  removeFavorite(id);
  renderFavorites();
  announce(t('notifications.deleted'));
  container.querySelector('#favorites-title')?.setAttribute('tabindex', '-1');
  container.querySelector('#favorites-title')?.focus();
}

/**
 * Put the focus back on a row's control after a re-render
 */
function focusRow(id, action) {
  const row = [...container.querySelectorAll('.ag-record')].find(r => r.dataset.id === id);
  row?.querySelector(`[data-action="${action}"]`)?.focus();
}

/**
 * Save current configuration as favorite
 * @param {Object} tablet
 * @param {Object} area
 * @param {string} [zone] - 'A' or 'B' in comparison mode, shown in the dialog
 */
export async function saveCurrentAsFavorite(tablet, area, zone = '') {
  const tabletName = tablet.isCustom ? t('tablet.custom') : `${tablet.brand} ${tablet.model}`;
  const defaultName = `${tabletName} · ${formatDecimal(area.width, 1)} × ${formatDecimal(area.height, 1)}`;

  const result = await showSaveFavoriteModal(
    defaultName,
    zone ? t('comparison.zone', { zone }) : ''
  );
  if (!result || !result.name.trim()) return null;

  const favorite = addFavorite({
    name: result.name.trim(),
    comment: result.comment.trim(),
    tablet,
    area,
  });

  renderFavorites();
  announce(t('notifications.saved'));
  return favorite;
}

/**
 * Initialize favorites module
 */
export function initFavorites(containerEl, onSelectFavorite = null) {
  container = containerEl;
  onSelect = onSelectFavorite;

  // One delegated listener survives every re-render
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const { id } = btn.closest('.ag-record').dataset;
      if (btn.dataset.action === 'load') {
        const favorite = getFavorites().find(f => f.id === id);
        if (favorite) {
          onSelect?.(favorite);
          announce(t('notifications.loaded'));
        }
      } else if (btn.dataset.action === 'edit') {
        editFavorite(id);
      } else if (btn.dataset.action === 'delete') {
        deleteFavorite(id);
      }
      return;
    }
    if (e.target.closest('#sort-direction')) {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      renderFavorites();
      container.querySelector('#sort-direction')?.focus();
    }
  });

  container.addEventListener('change', e => {
    if (e.target.id === 'favorites-sort') {
      currentSort = e.target.value;
      sortDirection = DEFAULT_DIRECTION[currentSort] ?? 'desc';
      renderFavorites();
      container.querySelector('#favorites-sort')?.focus();
    }
  });

  // Another tab saved or deleted a favorite
  window.addEventListener('storage', e => {
    if (e.key === null || e.key.startsWith('osurea:favorites')) renderFavorites();
  });

  renderFavorites();
}
