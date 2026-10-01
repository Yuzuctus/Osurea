/**
 * Osu!rea - Modal Module
 * Dialogs built on the native <dialog> element: focus trap, Escape and
 * focus return come from the browser. Every dialog body is a
 * <form method="dialog">, so Enter in a text field submits the primary
 * action and constraint validation (required, min, max) applies.
 * @module modal
 */

import { t } from './i18n.js';
import { icon } from './icons.js';
import { escapeHtml, formatDecimal } from './utils.js';
import { parseDecimal } from './number-field.js';

let dialogCount = 0;

/**
 * @typedef {Object} DialogAction
 * @property {string} label - Button text (already escaped or trusted)
 * @property {string} [value] - Value returned when this action closes the dialog
 * @property {boolean} [submit=false] - Primary action: submits the form
 * @property {string} [variant=''] - Extra classes, e.g. 'ag-button--solid'
 * @property {boolean} [autofocus=false]
 */

/**
 * Open a dialog and resolve when it closes.
 * @param {Object} options
 * @param {string} options.title - Escaped by the caller when it holds user text
 * @param {string} [options.kicker]
 * @param {string} [options.body] - Trusted HTML
 * @param {DialogAction[]} [options.actions]
 * @param {boolean} [options.wide=false]
 * @param {(dialog: HTMLDialogElement) => void} [options.onOpen]
 * @returns {Promise<{value: string, data: Object<string, string>}>}
 *   value is '' when the dialog was dismissed (Escape, close button, backdrop).
 */
export function openDialog({ title, kicker = '', body = '', actions = [], wide = false, onOpen }) {
  return new Promise(resolve => {
    const id = `dialog-title-${++dialogCount}`;
    const previouslyFocused = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = `os-dialog${wide ? ' os-dialog--wide' : ''}`;
    dialog.setAttribute('aria-labelledby', id);

    const actionsHtml = actions
      .map(
        (action, i) => `<button class="ag-button ${action.variant || ''}" data-action="${i}"
          type="${action.submit ? 'submit' : 'button'}" value="${escapeHtml(action.value ?? '')}"
          ${action.autofocus ? 'autofocus' : ''}>${action.label}</button>`
      )
      .join('');

    dialog.innerHTML = `
      <form method="dialog" class="os-dialog__form">
        <div class="os-dialog__head">
          <div>
            ${kicker ? `<p class="ag-kicker">${kicker}</p>` : ''}
            <h2 class="os-dialog__title" id="${id}">${title}</h2>
          </div>
          <button class="ag-button ag-button--icon ag-button--ghost" type="button" data-dismiss
            aria-label="${t('modal.close')}" title="${t('modal.close')}">${icon('close')}</button>
        </div>
        <div class="os-dialog__body">${body}</div>
        ${actionsHtml ? `<div class="os-dialog__foot">${actionsHtml}</div>` : ''}
      </form>
    `;
    document.body.appendChild(dialog);
    const form = dialog.querySelector('form');

    // Non-submit actions close with their own value (Cancel closes with '').
    dialog.addEventListener('click', e => {
      const btn = e.target.closest('button[type="button"]');
      if (!btn) return;
      if (btn.hasAttribute('data-dismiss')) dialog.close('');
      else if (btn.dataset.action !== undefined) {
        const action = actions[Number(btn.dataset.action)];
        if (action && !action.keepOpen) dialog.close(action.value ?? '');
      }
    });

    // Backdrop: a press that starts and ends outside the dialog box dismisses it.
    let pressedOnBackdrop = false;
    dialog.addEventListener('pointerdown', e => {
      pressedOnBackdrop = e.target === dialog;
    });
    dialog.addEventListener('click', e => {
      if (pressedOnBackdrop && e.target === dialog) dialog.close('');
      pressedOnBackdrop = false;
    });

    dialog.addEventListener('close', () => {
      const data = Object.fromEntries(new FormData(form));
      const value = dialog.returnValue;
      dialog.remove();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
      resolve({ value, data });
    });

    dialog.returnValue = '';
    dialog.showModal();
    onOpen?.(dialog);
  });
}

/**
 * Confirm a destructive action. Cancel has the focus by default.
 * @param {string} message - Plain text
 * @param {string} title - Plain text
 * @param {string} confirmText - Plain text
 * @returns {Promise<boolean>}
 */
export async function confirmDelete(message, title, confirmText = t('modal.delete')) {
  const { value } = await openDialog({
    title: escapeHtml(title),
    body: `<p>${escapeHtml(message)}</p>`,
    actions: [
      { label: t('modal.cancel'), value: '', variant: 'ag-button--quiet', autofocus: true },
      {
        label: escapeHtml(confirmText),
        value: 'confirm',
        submit: true,
        variant: 'ag-button--danger',
      },
    ],
  });
  return value === 'confirm';
}

/**
 * Name + comment fields shared by the save and edit dialogs.
 * @param {string} name
 * @param {string} comment
 * @returns {string}
 */
function nameFields(name, comment) {
  return `
    <label class="ag-field">
      <span class="ag-field__label">${t('favorites.name')}</span>
      <input class="ag-input" type="text" name="name" value="${escapeHtml(name)}" maxlength="80"
        required autofocus data-name />
    </label>
    <label class="ag-field">
      <span class="ag-field__label">${t('favorites.comment')}</span>
      <textarea class="ag-input os-textarea" name="comment" rows="3" maxlength="500"
        placeholder="${escapeHtml(t('favorites.commentPlaceholder'))}">${escapeHtml(comment)}</textarea>
    </label>
  `;
}

/**
 * Validate the dialog's fields as the user types, so the browser refuses to
 * submit (and says why) instead of closing on a value that cannot be used:
 * a name made of spaces, a number that is not one or is out of its range.
 * @param {HTMLDialogElement} dialog
 */
function validateFields(dialog) {
  const check = input => {
    let message = '';
    if (input.hasAttribute('data-name')) {
      if (input.value.trim() === '') message = t('favorites.nameRequired');
    } else if (input.hasAttribute('data-min')) {
      const value = parseDecimal(input.value);
      const min = Number(input.dataset.min);
      const max = Number(input.dataset.max);
      const { unit } = input.dataset;
      if (value === null) message = t('error.number');
      else if (value < min - 1e-9) message = t('error.min', { value: formatDecimal(min), unit });
      else if (value > max + 1e-9) message = t('error.max', { value: formatDecimal(max), unit });
    }
    input.setCustomValidity(message);
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const hint = input.closest('.ag-field')?.querySelector('.ag-field__hint');
    if (hint) {
      hint.textContent = message || hint.dataset.hint || '';
      hint.classList.toggle('is-error', Boolean(message));
    }
  };
  dialog.querySelectorAll('[data-name], [data-min]').forEach(input => {
    check(input);
    input.addEventListener('input', () => check(input));
  });
}

/**
 * Ask for a favorite's name and comment.
 * @param {string} defaultName
 * @param {string} [kicker] - e.g. the zone being saved in comparison mode
 * @returns {Promise<{name: string, comment: string}|null>}
 */
export async function showSaveFavoriteModal(defaultName = '', kicker = '') {
  const { value, data } = await openDialog({
    title: t('favorites.save'),
    kicker,
    body: `<div class="ag-stack">${nameFields(defaultName, '')}</div>`,
    actions: [
      { label: t('modal.cancel'), value: '', variant: 'ag-button--quiet' },
      { label: t('modal.save'), value: 'save', submit: true, variant: 'ag-button--solid' },
    ],
    onOpen: validateFields,
  });
  if (value !== 'save') return null;
  return { name: data.name ?? '', comment: data.comment ?? '' };
}

/**
 * A number field for the edit dialog: text, so "60,5" and "60.5" both work.
 */
function numberField(name, label, value, { min, max, unit = 'mm', integer = false }) {
  const hint = t('hint.range', { min: formatDecimal(min, 1), max: formatDecimal(max, 1), unit });
  return `
    <div class="ag-field">
      <label class="ag-field__label" for="edit-${name}">${label}</label>
      <span class="os-unit" data-unit="${unit}">
        <input class="ag-input" type="text" id="edit-${name}" name="${name}" value="${formatDecimal(value)}"
          inputmode="${integer ? 'numeric' : 'decimal'}" autocomplete="off" spellcheck="false"
          data-min="${min}" data-max="${max}" data-unit="${unit}" aria-describedby="edit-${name}-hint" required />
      </span>
      <span class="ag-field__hint" id="edit-${name}-hint" data-hint="${escapeHtml(hint)}">${hint}</span>
    </div>
  `;
}

/**
 * Edit a favorite: name, comment and the whole area, bounded by its tablet.
 * Numbers come back parsed; the caller keeps the area on the tablet.
 * @param {Object} favorite
 * @returns {Promise<Object|null>} - Values, or null when dismissed
 */
export async function showEditFavoriteModal(favorite) {
  const { area, tablet } = favorite;
  const body = `
    <div class="ag-stack">
      ${nameFields(favorite.name || '', favorite.comment || '')}
      <p class="ag-kicker">${t('area.title')} · ${escapeHtml(
        tablet.isCustom ? t('tablet.custom') : `${tablet.brand} ${tablet.model}`.trim()
      )}</p>
      <div class="os-pair">
        ${numberField('width', t('area.width'), area.width, { min: 1, max: tablet.width })}
        ${numberField('height', t('area.height'), area.height, { min: 1, max: tablet.height })}
      </div>
      <div class="os-pair">
        ${numberField('x', t('area.x'), area.x, { min: 0, max: tablet.width })}
        ${numberField('y', t('area.y'), area.y, { min: 0, max: tablet.height })}
      </div>
      <div class="os-pair">
        ${numberField('radius', t('area.radius'), area.radius || 0, { min: 0, max: 100, unit: '%', integer: true })}
        ${numberField('rotation', t('area.rotation'), area.rotation || 0, { min: -180, max: 180, unit: '°', integer: true })}
      </div>
    </div>
  `;

  const { value, data } = await openDialog({
    title: t('favorites.edit'),
    kicker: escapeHtml(favorite.name || ''),
    body,
    actions: [
      { label: t('modal.cancel'), value: '', variant: 'ag-button--quiet' },
      { label: t('modal.save'), value: 'save', submit: true, variant: 'ag-button--solid' },
    ],
    onOpen: validateFields,
  });
  if (value !== 'save') return null;
  const result = { name: data.name ?? '', comment: data.comment ?? '' };
  for (const key of ['width', 'height', 'x', 'y', 'radius', 'rotation']) {
    result[key] = parseDecimal(data[key]);
  }
  return result;
}

/**
 * Show the summary of the active area, with a copy action.
 * @param {Object} data - Formatted values
 * @param {string} copyText - Plain text put on the clipboard
 */
export async function showRecapModal(data, copyText) {
  const rows = [
    [t('tablet.title'), escapeHtml(data.tablet)],
    [t('area.size'), `${data.width} × ${data.height} mm`],
    [t('area.ratio'), data.ratio],
    [t('area.surface'), `${data.surface} mm²`],
    [t('area.coverageX'), `${data.coverageX} %`],
    [t('area.coverageY'), `${data.coverageY} %`],
    [t('area.position'), `${data.position} mm`],
    [t('area.radius'), `${data.radius} %`],
    [t('area.rotation'), `${data.rotation}°`],
  ];
  const body = `<dl class="ag-notes">${rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd class="ag-num">${value}</dd></div>`)
    .join('')}</dl>`;

  await openDialog({
    title: t('area.recap'),
    kicker: data.zone ? t('comparison.zone', { zone: data.zone }) : '',
    body,
    actions: [
      { label: t('recap.copy'), value: 'copy', variant: 'ag-button--quiet', keepOpen: true },
      {
        label: t('modal.ok'),
        value: 'ok',
        submit: true,
        variant: 'ag-button--solid',
        autofocus: true,
      },
    ],
    onOpen: dialog => {
      const copyBtn = dialog.querySelector('[value="copy"]');
      copyBtn?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(copyText);
          copyBtn.textContent = t('recap.copied');
          announce(t('notifications.copied'));
        } catch {
          announce(t('notifications.error'));
        }
      });
    },
  });
}

/**
 * Announce a message to screen readers.
 * @param {string} message
 */
export function announce(message) {
  const region = document.querySelector('#aria-live-region');
  if (!region) return;
  region.textContent = '';
  // A new text node after a tick makes repeated messages audible again.
  setTimeout(() => {
    region.textContent = message;
  }, 50);
}
