/**
 * Osu!rea - History Module
 * Undo/redo for area modifications. One history per zone, so undoing in
 * zone B never replays a change made to zone A.
 * @module history
 */

import { MAX_HISTORY_SIZE } from '../constants/index.js';

const AREA_KEYS = ['x', 'y', 'width', 'height', 'radius', 'rotation'];

/**
 * Copy the fields of an area that history tracks, with the tablet it was
 * set on: undoing past a change of tablet brings that tablet back too.
 * @param {Object} area
 * @param {Object} [tablet]
 * @returns {Object}
 */
function snapshot(area, tablet) {
  const copy = {};
  for (const key of AREA_KEYS) copy[key] = area[key] ?? 0;
  if (tablet) copy.tablet = { ...tablet };
  return copy;
}

const sameTablet = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
function sameEntry(a, b) {
  return AREA_KEYS.every(key => (a[key] ?? 0) === (b[key] ?? 0)) && sameTablet(a.tablet, b.tablet);
}

/**
 * Create an undo/redo history.
 *
 * `push` records the state reached after a change. The latest entry is the
 * current state, so `undo` returns the entry before it.
 *
 * @param {number} [limit=MAX_HISTORY_SIZE]
 */
export function createHistory(limit = MAX_HISTORY_SIZE) {
  let past = [];
  let future = [];

  return {
    /**
     * @param {Object} area - State reached after a change
     * @param {Object} [tablet] - Tablet the area is on
     */
    push(area, tablet) {
      const entry = snapshot(area, tablet);
      if (past.length > 0 && sameEntry(past[past.length - 1], entry)) return;
      past.push(entry);
      if (past.length > limit) past.shift();
      future = [];
    },

    /** @returns {Object|null} - Previous area state, or null */
    undo() {
      if (past.length < 2) return null;
      future.push(past.pop());
      return structuredClone(past[past.length - 1]);
    },

    /** @returns {Object|null} - Next area state, or null */
    redo() {
      if (future.length === 0) return null;
      const next = future.pop();
      past.push(next);
      return structuredClone(next);
    },

    canUndo() {
      return past.length > 1;
    },

    canRedo() {
      return future.length > 0;
    },

    clear() {
      past = [];
      future = [];
    },
  };
}

/**
 * Whether a keyboard event comes from a field that has its own undo.
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['range', 'checkbox', 'radio', 'button'].includes(target.type);
  }
  return false;
}

/**
 * Initialize keyboard shortcuts for undo/redo:
 * Ctrl/Cmd + Z, and Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y.
 * Text fields keep their own undo; an open dialog disables the shortcuts.
 * @param {Function} onUndo
 * @param {Function} onRedo
 * @returns {Function} - Cleanup function
 */
export function initKeyboardShortcuts(onUndo, onRedo) {
  const handleKeydown = e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (isEditableTarget(e.target) || document.querySelector('dialog[open]')) return;

    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      onUndo();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      onRedo();
    }
  };

  document.addEventListener('keydown', handleKeydown);
  return () => document.removeEventListener('keydown', handleKeydown);
}
