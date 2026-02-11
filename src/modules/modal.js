/**
 * Osu!rea - Modal Module
 * Custom modal dialogs to replace native prompt/confirm/alert
 * @module modal
 */

import { t } from './i18n.js';
import { icon } from './icons.js';
import { escapeHtml } from './utils.js';

/**
 * @typedef {Object} ModalOptions
 * @property {string} [title=''] - Modal title
 * @property {string} [message=''] - Modal message
 * @property {'confirm'|'prompt'|'alert'|'edit-favorite'} [type='confirm'] - Modal type
 * @property {string} [inputValue=''] - Default input value (for prompt)
 * @property {string} [inputPlaceholder=''] - Input placeholder (for prompt)
 * @property {string} [confirmText] - Confirm button text
 * @property {string} [cancelText] - Cancel button text
 * @property {string} [confirmClass='btn-primary'] - Confirm button CSS class
 * @property {boolean} [showCancel=true] - Whether to show cancel button
 * @property {string|null} [customContent=null] - Custom HTML content for body
 */

/** @type {HTMLElement|null} */
let modalContainer = null;

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - Container element
 * @returns {HTMLElement[]} - Array of focusable elements
 */
function getFocusableElements(container) {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'a[href]',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors));
}

/**
 * Create a focus trap within a modal
 * @param {HTMLElement} modal - Modal element
 * @returns {Function} - Cleanup function to remove the trap
 */
function createFocusTrap(modal) {
  const focusableElements = getFocusableElements(modal);
  const firstFocusable = focusableElements[0];

  // Store previously focused element to restore later
  const previouslyFocused = document.activeElement;

  const handleTabKey = e => {
    if (e.key !== 'Tab') return;

    // Update focusable elements in case they changed
    const currentFocusable = getFocusableElements(modal);
    const first = currentFocusable[0];
    const last = currentFocusable[currentFocusable.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: go to last element if on first
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      // Tab: go to first element if on last
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  modal.addEventListener('keydown', handleTabKey);

  // Focus first element
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    modal.removeEventListener('keydown', handleTabKey);
    // Restore focus to previously focused element
    previouslyFocused?.focus?.();
  };
}

/**
 * Initialize modal container
 */
function ensureContainer() {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-container';
    modalContainer.className = 'modal-container hidden';
    document.body.appendChild(modalContainer);
  }
  return modalContainer;
}

/**
 * Show a modal dialog
 * @param {object} options - Modal options
 * @returns {Promise} - Resolves with result
 */
function showModal(options) {
  const {
    title = '',
    message = '',
    type = 'confirm',
    inputValue = '',
    inputPlaceholder = '',
    confirmText = t('modal.confirm'),
    cancelText = t('modal.cancel'),
    confirmClass = 'btn-primary',
    showCancel = true,
    customContent = null,
  } = options;

  return new Promise(resolve => {
    const container = ensureContainer();

    let bodyContent = '';

    if (customContent) {
      bodyContent = customContent;
    } else if (type === 'prompt') {
      bodyContent = `
        ${message ? `<p class="modal-message">${escapeHtml(message)}</p>` : ''}
        <input 
          type="text" 
          class="input modal-input" 
          id="modal-input" 
          value="${escapeHtml(inputValue)}"
          placeholder="${escapeHtml(inputPlaceholder)}"
          autofocus
        >
      `;
    } else {
      bodyContent = message ? `<p class="modal-message">${escapeHtml(message)}</p>` : '';
    }

    const cancelBtnHtml = showCancel
      ? `
      <button class="btn btn-secondary modal-cancel" id="modal-cancel">
        ${cancelText}
      </button>
    `
      : '';

    container.innerHTML = `
      <div class="modal-overlay" id="modal-overlay"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h3 class="modal-title" id="modal-title">${escapeHtml(title)}</h3>
          <button class="btn-icon modal-close" id="modal-close" aria-label="Close">
            ${icon('close')}
          </button>
        </div>
        <div class="modal-body">
          ${bodyContent}
        </div>
        <div class="modal-footer">
          ${cancelBtnHtml}
          <button class="btn ${confirmClass} modal-confirm" id="modal-confirm">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    container.classList.remove('hidden');

    // Get the modal element for focus trap
    const modal = container.querySelector('.modal');
    let cleanupFocusTrap = null;

    if (modal) {
      cleanupFocusTrap = createFocusTrap(modal);
    }

    const input = container.querySelector('#modal-input');
    const confirmBtn = container.querySelector('#modal-confirm');

    if (input) {
      input.focus();
      input.select();
    } else {
      confirmBtn.focus();
    }

    const close = result => {
      // Cleanup focus trap before closing
      if (cleanupFocusTrap) {
        cleanupFocusTrap();
      }
      container.classList.add('hidden');
      resolve(result);
    };

    confirmBtn.addEventListener('click', () => {
      if (type === 'prompt') {
        const value = container.querySelector('#modal-input')?.value;
        close(value);
      } else if (type === 'save-favorite') {
        // Collect name and comment for save favorite
        const formData = {
          name: container.querySelector('#save-name')?.value,
          comment: container.querySelector('#save-comment')?.value,
        };
        close(formData);
      } else if (type === 'edit-favorite') {
        // Collect all form data including comment
        const formData = {
          name: container.querySelector('#edit-name')?.value,
          comment: container.querySelector('#edit-comment')?.value,
          width: parseFloat(container.querySelector('#edit-width')?.value) || 0,
          height: parseFloat(container.querySelector('#edit-height')?.value) || 0,
          x: parseFloat(container.querySelector('#edit-x')?.value) || 0,
          y: parseFloat(container.querySelector('#edit-y')?.value) || 0,
          radius: parseInt(container.querySelector('#edit-radius')?.value, 10) || 0,
        };
        close(formData);
      } else {
        close(true);
      }
    });

    const cancelBtn = container.querySelector('#modal-cancel');
    cancelBtn?.addEventListener('click', () => close(null));

    const closeBtn = container.querySelector('#modal-close');
    closeBtn?.addEventListener('click', () => close(null));

    const overlay = container.querySelector('#modal-overlay');
    overlay?.addEventListener('click', () => close(null));

    const handleKeydown = e => {
      if (e.key === 'Enter' && type !== 'edit-favorite') {
        e.preventDefault();
        if (type === 'prompt') {
          const value = container.querySelector('#modal-input')?.value;
          close(value);
        } else {
          close(true);
        }
      } else if (e.key === 'Escape') {
        close(null);
      }
    };

    container.addEventListener('keydown', handleKeydown);
  });
}

/**
 * Show confirmation dialog
 */
export async function confirm(message, title = '') {
  const result = await showModal({
    type: 'confirm',
    title,
    message,
    confirmText: t('modal.confirm'),
    cancelText: t('modal.cancel'),
  });
  return result === true;
}

/**
 * Show confirmation dialog for deletion
 */
export async function confirmDelete(message, title = '') {
  const result = await showModal({
    type: 'confirm',
    title,
    message,
    confirmText: t('modal.delete'),
    cancelText: t('modal.cancel'),
    confirmClass: 'btn-danger',
  });
  return result === true;
}

/**
 * Show prompt dialog
 */
export async function prompt(message, defaultValue = '', title = '') {
  return showModal({
    type: 'prompt',
    title,
    message,
    inputValue: defaultValue,
    confirmText: t('modal.save'),
    cancelText: t('modal.cancel'),
  });
}

/**
 * Show alert dialog
 */
export async function alert(message, title = '') {
  await showModal({
    type: 'alert',
    title,
    message,
    confirmText: 'OK',
    showCancel: false,
  });
}

/**
 * Show recap modal with area information
 */
export async function showRecapModal(data) {
  const content = `
    <div class="recap-modal-content">
      <div class="recap">
        <div class="recap-item">
          <span class="recap-label">${t('area.widthMm')}</span>
          <span class="recap-value">${data.width} mm</span>
        </div>
        <div class="recap-item">
          <span class="recap-label">${t('area.heightMm')}</span>
          <span class="recap-value">${data.height} mm</span>
        </div>
        <div class="recap-item">
          <span class="recap-label">${t('area.ratio')}</span>
          <span class="recap-value">${data.ratio}</span>
        </div>
        <div class="recap-item">
          <span class="recap-label">${t('area.surface')}</span>
          <span class="recap-value">${data.surface} mm²</span>
        </div>
        <div class="recap-item">
          <span class="recap-label">${t('area.coverageX')}</span>
          <span class="recap-value">${data.coverageX}%</span>
        </div>
        <div class="recap-item">
          <span class="recap-label">${t('area.coverageY')}</span>
          <span class="recap-value">${data.coverageY}%</span>
        </div>
        <div class="recap-item">
          <span class="recap-label">${t('area.position')}</span>
          <span class="recap-value">${data.position}</span>
        </div>
      </div>
    </div>
  `;

  await showModal({
    type: 'alert',
    title: t('area.recap'),
    customContent: content,
    confirmText: 'OK',
    showCancel: false,
  });
}

/**
 * Show save favorite modal with name and comment fields
 */
export async function showSaveFavoriteModal(defaultName = '') {
  const content = `
    <div class="modal-form">
      <div class="modal-form-section">
        <div class="input-group">
          <label for="save-name">${t('favorites.namePrompt')}</label>
          <input type="text" id="save-name" class="input" value="${escapeHtml(defaultName)}" />
        </div>
      </div>
      
      <div class="modal-form-section">
        <div class="input-group">
          <label for="save-comment">${t('favorites.commentLabel')}</label>
          <textarea 
            id="save-comment" 
            class="input textarea" 
            rows="3" 
            placeholder="${t('favorites.commentPlaceholder')}"
          ></textarea>
        </div>
      </div>
    </div>
  `;

  return showModal({
    type: 'save-favorite',
    title: t('favorites.save'),
    customContent: content,
    confirmText: t('modal.save'),
    cancelText: t('modal.cancel'),
  });
}

/**
 * Show edit favorite modal with all fields
 */
export async function showEditFavoriteModal(favorite) {
  const radiusValue = favorite.area?.radius || 0;
  const content = `
    <div class="modal-form">
      <div class="modal-form-section">
        <div class="input-group">
          <label for="edit-name">${t('favorites.namePrompt')}</label>
          <input type="text" id="edit-name" class="input" value="${escapeHtml(favorite.name || '')}" />
        </div>
      </div>
      
      <div class="modal-form-section">
        <div class="input-group">
          <label for="edit-comment">${t('favorites.commentLabel')}</label>
          <textarea 
            id="edit-comment" 
            class="input textarea" 
            rows="3" 
            placeholder="${t('favorites.commentPlaceholder')}"
          >${escapeHtml(favorite.comment || '')}</textarea>
        </div>
      </div>
      
      <div class="modal-form-section">
        <h4>${t('area.title')}</h4>
        <div class="input-row">
          <div class="input-group">
            <label for="edit-width">${t('area.width')}</label>
            <input type="number" id="edit-width" class="input" value="${
              favorite.area?.width || 0
            }" step="0.1" min="1" />
          </div>
          <div class="input-group">
            <label for="edit-height">${t('area.height')}</label>
            <input type="number" id="edit-height" class="input" value="${
              favorite.area?.height || 0
            }" step="0.1" min="1" />
          </div>
        </div>
        
        <div class="input-row mt-md">
          <div class="input-group">
            <label for="edit-x">${t('area.positionX')}</label>
            <input type="number" id="edit-x" class="input" value="${
              favorite.area?.x || 0
            }" step="0.1" min="0" />
          </div>
          <div class="input-group">
            <label for="edit-y">${t('area.positionY')}</label>
            <input type="number" id="edit-y" class="input" value="${
              favorite.area?.y || 0
            }" step="0.1" min="0" />
          </div>
        </div>
        
        <div class="input-group mt-md">
          <label for="edit-radius">${t('area.radius')}</label>
          <div class="slider-with-value">
            <input type="range" id="edit-radius" class="slider" min="0" max="100" value="${radiusValue}" step="1" />
            <span class="slider-value" id="edit-radius-value">${radiusValue}%</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Show modal and setup slider listener
  const result = showModal({
    type: 'edit-favorite',
    title: t('favorites.edit'),
    customContent: content,
    confirmText: t('modal.save'),
    cancelText: t('modal.cancel'),
  });

  // Add listener for slider value update after modal is rendered
  setTimeout(() => {
    const slider = document.querySelector('#edit-radius');
    const valueDisplay = document.querySelector('#edit-radius-value');
    if (slider && valueDisplay) {
      slider.addEventListener('input', () => {
        valueDisplay.textContent = `${slider.value}%`;
      });
    }
  }, 0);

  return result;
}
