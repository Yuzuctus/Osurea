/**
 * Osu!rea - History Module
 * Undo/Redo functionality for area modifications
 */

import { MAX_HISTORY_SIZE } from '../constants/index.js';

/**
 * @typedef {Object} HistoryEntry
 * @property {Object} area - Area state snapshot
 * @property {number} timestamp - When this entry was created
 */

/** @type {HistoryEntry[]} */
let past = [];

/** @type {HistoryEntry[]} */
let future = [];

/** @type {Set<Function>} */
const subscribers = new Set();

/**
 * Create a snapshot of the area state
 * @param {Object} area - Area object
 * @returns {HistoryEntry}
 */
function createSnapshot(area) {
  return {
    area: { ...area },
    timestamp: Date.now(),
  };
}

/**
 * Push a new state to the history
 * @param {Object} area - Current area state to save
 */
export function pushState(area) {
  // Don't push if the state is the same as the last one
  if (past.length > 0) {
    const lastEntry = past[past.length - 1];
    if (
      lastEntry.area.x === area.x &&
      lastEntry.area.y === area.y &&
      lastEntry.area.width === area.width &&
      lastEntry.area.height === area.height &&
      lastEntry.area.radius === area.radius &&
      lastEntry.area.rotation === area.rotation
    ) {
      return;
    }
  }

  past.push(createSnapshot(area));

  // Limit history size
  if (past.length > MAX_HISTORY_SIZE) {
    past.shift();
  }

  // Clear future when new action is taken
  future = [];

  notifySubscribers();
}

/**
 * Undo the last action
 * @param {Object} currentArea - Current area state before undo
 * @returns {Object|null} - Previous area state or null if can't undo
 */
export function undo(currentArea) {
  if (past.length === 0) {
    return null;
  }

  // Save current state to future
  future.push(createSnapshot(currentArea));

  // Get previous state
  const previousEntry = past.pop();

  notifySubscribers();

  return previousEntry.area;
}

/**
 * Redo the last undone action
 * @param {Object} currentArea - Current area state before redo
 * @returns {Object|null} - Next area state or null if can't redo
 */
export function redo(currentArea) {
  if (future.length === 0) {
    return null;
  }

  // Save current state to past
  past.push(createSnapshot(currentArea));

  // Get next state
  const nextEntry = future.pop();

  notifySubscribers();

  return nextEntry.area;
}

/**
 * Check if undo is available
 * @returns {boolean}
 */
export function canUndo() {
  return past.length > 0;
}

/**
 * Check if redo is available
 * @returns {boolean}
 */
export function canRedo() {
  return future.length > 0;
}

/**
 * Clear all history
 */
export function clearHistory() {
  past = [];
  future = [];
  notifySubscribers();
}

/**
 * Get history info for debugging/UI
 * @returns {Object}
 */
export function getHistoryInfo() {
  return {
    pastCount: past.length,
    futureCount: future.length,
    canUndo: canUndo(),
    canRedo: canRedo(),
  };
}

/**
 * Subscribe to history changes
 * @param {Function} callback - Function to call when history changes
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToHistory(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Notify subscribers of history change
 */
function notifySubscribers() {
  const info = getHistoryInfo();
  subscribers.forEach(callback => {
    try {
      callback(info);
    } catch (error) {
      console.error('History subscriber error:', error);
    }
  });
}

/**
 * Initialize keyboard shortcuts for undo/redo
 * @param {Function} onUndo - Callback when undo is triggered
 * @param {Function} onRedo - Callback when redo is triggered
 * @returns {Function} - Cleanup function to remove listeners
 */
export function initKeyboardShortcuts(onUndo, onRedo) {
  const handleKeydown = e => {
    // Check for Ctrl/Cmd + Z (Undo)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) {
        onUndo();
      }
    }
    // Check for Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y (Redo)
    else if (
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
      ((e.ctrlKey || e.metaKey) && e.key === 'y')
    ) {
      e.preventDefault();
      if (canRedo()) {
        onRedo();
      }
    }
  };

  document.addEventListener('keydown', handleKeydown);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeydown);
  };
}

export default {
  pushState,
  undo,
  redo,
  canUndo,
  canRedo,
  clearHistory,
  getHistoryInfo,
  subscribeToHistory,
  initKeyboardShortcuts,
};
