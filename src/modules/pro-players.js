/**
 * Osu!rea - Pro Players Module
 * Load and display pro player area configurations
 * @module pro-players
 */

import { icon } from './icons.js';
import { t } from './i18n.js';
import { logWarn } from './logger.js';
import { escapeHtml } from './utils.js';
import { generatePreview } from './preview.js';

/** @type {Array} - Cached pro players data */
let proPlayersData = [];

/** @type {Function|null} - Callback when a player config is selected */
let onSelect = null;

/** @type {boolean} - Whether data has been fetched */
let dataLoaded = false;

/** @type {HTMLElement|null} - Modal container */
let modalContainer = null;

/**
 * Render a single player card
 */
function renderPlayerCard(player) {
  const { name, tablet, area } = player;
  return `
    <div class="pro-player-card" data-name="${escapeHtml(name)}">
      <div class="pro-player-preview-wrapper">
        ${generatePreview(tablet, area, 'pro-player-preview')}
      </div>
      <div class="pro-player-info">
        <h3 class="pro-player-name">${escapeHtml(name)}</h3>
        <div class="pro-player-details">
          <span class="pro-player-tablet">${escapeHtml(tablet.brand)} ${escapeHtml(tablet.model)}</span>
          <span class="pro-player-area">${area.width.toFixed(1)} × ${area.height.toFixed(1)} mm</span>
        </div>
      </div>
      <button class="pro-player-load" title="${t('proPlayers.load')}">
        ${icon('play')}
      </button>
    </div>
  `;
}

/**
 * Create and show the pro players modal
 */
function showProPlayersModal() {
  if (modalContainer) {
    modalContainer.remove();
  }

  modalContainer = document.createElement('div');
  modalContainer.className = 'modal-container';
  modalContainer.id = 'pro-players-modal';

  const playersHtml =
    proPlayersData.length > 0
      ? `<div class="pro-players-list">${proPlayersData.map(p => renderPlayerCard(p)).join('')}</div>`
      : `<div class="pro-players-empty">
        ${icon('users')}
        <p data-i18n="proPlayers.empty">${t('proPlayers.empty')}</p>
      </div>`;

  modalContainer.innerHTML = `
    <div class="modal-overlay" id="pro-players-overlay"></div>
    <div class="modal pro-players-modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="modal-title">
          ${icon('users')}
          <span data-i18n="proPlayers.title">${t('proPlayers.title')}</span>
        </h3>
        <button class="btn-icon modal-close" aria-label="Close">
          ${icon('close')}
        </button>
      </div>
      <div class="modal-body">
        ${playersHtml}
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  // Setup event listeners
  const overlay = modalContainer.querySelector('#pro-players-overlay');
  const closeBtn = modalContainer.querySelector('.modal-close');

  overlay?.addEventListener('click', hideProPlayersModal);
  closeBtn?.addEventListener('click', hideProPlayersModal);

  // Player card clicks
  modalContainer.querySelectorAll('.pro-player-card').forEach(card => {
    const playerName = card.dataset.name;
    const player = proPlayersData.find(p => p.name === playerName);

    card.addEventListener('click', () => {
      if (player && onSelect) {
        onSelect(player);
        hideProPlayersModal();
      }
    });

    card.querySelector('.pro-player-load')?.addEventListener('click', e => {
      e.stopPropagation();
      if (player && onSelect) {
        onSelect(player);
        hideProPlayersModal();
      }
    });
  });

  // Close on escape
  const handleEscape = e => {
    if (e.key === 'Escape') {
      hideProPlayersModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Animate in
  requestAnimationFrame(() => {
    modalContainer.classList.add('visible');
  });
}

/**
 * Hide the pro players modal
 */
function hideProPlayersModal() {
  if (modalContainer) {
    modalContainer.classList.remove('visible');
    setTimeout(() => {
      modalContainer?.remove();
      modalContainer = null;
    }, 200);
  }
}

/**
 * Fetch pro players data from JSON
 */
async function fetchProPlayers() {
  try {
    const response = await fetch('/pro-players.json');
    if (!response.ok) {
      throw new Error('Failed to load pro players data');
    }
    const data = await response.json();
    proPlayersData = data.players || [];
    return proPlayersData;
  } catch (error) {
    logWarn('Failed to load pro players:', error);
    proPlayersData = [];
    return [];
  }
}

/**
 * Initialize pro players module
 * @param {Function} onSelectPlayer - Callback when a player config is selected
 */
export function initProPlayers(onSelectPlayer = null) {
  onSelect = onSelectPlayer;
}

/**
 * Open the pro players selection modal (lazy-loads data on first open)
 */
export async function openProPlayersModal() {
  if (!dataLoaded) {
    await fetchProPlayers();
    dataLoaded = true;
  }
  showProPlayersModal();
}

/**
 * Get all pro players data
 */
export function getProPlayers() {
  return [...proPlayersData];
}
