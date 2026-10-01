/**
 * Osu!rea - Pro Players Module
 * Load and display pro player area configurations (lazy, on first open)
 * @module pro-players
 */

import { t } from './i18n.js';
import { calculateRatioString, escapeHtml, formatDecimal } from './utils.js';
import { generatePreview } from './preview.js';
import { announce, openDialog } from './modal.js';

/** @type {Array|null} - Cached pro players data, null until loaded */
let proPlayersData = null;

/** @type {Function|null} - Callback when a player config is selected */
let onSelect = null;

/**
 * Fetch pro players data from JSON. A failed load is retried next time.
 * @returns {Promise<Array|null>} - null on failure
 */
async function fetchProPlayers() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}pro-players.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    proPlayersData = Array.isArray(data.players) ? data.players : [];
    return proPlayersData;
  } catch (error) {
    console.warn('Failed to load pro players:', error);
    return null;
  }
}

/**
 * Render a single player row
 */
function renderPlayerRow(player, index) {
  const name = player.name.trim();
  const { tablet, area } = player;
  const meta = [
    escapeHtml(`${tablet.brand} ${tablet.model}`),
    `${formatDecimal(area.width, 1)} × ${formatDecimal(area.height, 1)} mm`,
    calculateRatioString(area.width, area.height),
    area.rotation ? `${area.rotation}°` : '',
  ].filter(Boolean);

  return `
    <li class="ag-record">
      <span class="ag-record__rank">${String(index + 1).padStart(2, '0')}</span>
      <div class="ag-record__copy">
        <h3 class="ag-record__title">${escapeHtml(name)}</h3>
        <p class="ag-record__meta">${meta.join(' · ')}</p>
      </div>
      <button class="ag-record__primary" type="submit" value="${index}"
        aria-label="${escapeHtml(t('proPlayers.load', { name }))}"></button>
      <div class="ag-record__media">${generatePreview(tablet, area)}</div>
    </li>
  `;
}

/**
 * Initialize pro players module
 * @param {Function} onSelectPlayer - Callback when a player config is selected
 */
export function initProPlayers(onSelectPlayer = null) {
  onSelect = onSelectPlayer;
}

/**
 * Open the pro players dialog (lazy-loads data on first open)
 */
export async function openProPlayersModal() {
  const players = proPlayersData ?? (await fetchProPlayers());

  let body;
  if (players === null) {
    body = `<div class="ag-state ag-state--error" role="alert">
      <p class="ag-state__title">${t('proPlayers.loadError')}</p></div>`;
  } else if (players.length === 0) {
    body = `<div class="ag-state"><p class="ag-state__body">${t('proPlayers.empty')}</p></div>`;
  } else {
    body = `<ol class="ag-records os-records">${players.map(renderPlayerRow).join('')}</ol>`;
  }

  const { value } = await openDialog({
    title: t('proPlayers.title'),
    kicker: t('proPlayers.kicker'),
    body,
    wide: true,
    actions: [{ label: t('modal.close'), value: '', variant: 'ag-button--quiet' }],
  });

  const player = value !== '' ? players?.[Number(value)] : null;
  if (player) {
    onSelect?.(player);
    announce(t('notifications.loaded'));
  }
}
