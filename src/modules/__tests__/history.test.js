import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pushState,
  undo,
  redo,
  canUndo,
  canRedo,
  clearHistory,
  getHistoryInfo,
  subscribeToHistory,
  initKeyboardShortcuts,
} from '../history.js';

describe('history', () => {
  const areaA = { x: 10, y: 20, width: 80, height: 50, radius: 0, rotation: 0 };
  const areaB = { x: 11, y: 22, width: 78, height: 48, radius: 3, rotation: 2 };

  beforeEach(() => {
    clearHistory();
  });

  it('pushes unique states only', () => {
    pushState(areaA);
    pushState(areaA);

    expect(getHistoryInfo().pastCount).toBe(1);
  });

  it('handles undo/redo lifecycle', () => {
    pushState(areaA);
    pushState(areaB);

    const previous = undo(areaB);
    expect(previous).toEqual(areaB);
    expect(canRedo()).toBe(true);

    const next = redo(areaA);
    expect(next).toEqual(areaB);
    expect(canUndo()).toBe(true);
  });

  it('notifies subscribers and tolerates subscriber errors', () => {
    const okSubscriber = vi.fn();
    const failingSubscriber = vi.fn(() => {
      throw new Error('subscriber failed');
    });

    const unsubOk = subscribeToHistory(okSubscriber);
    const unsubFailing = subscribeToHistory(failingSubscriber);

    pushState(areaA);

    expect(okSubscriber).toHaveBeenCalledTimes(1);
    expect(failingSubscriber).toHaveBeenCalledTimes(1);

    unsubOk();
    unsubFailing();
  });

  it('binds and unbinds keyboard shortcuts', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    pushState(areaA);

    const cleanup = initKeyboardShortcuts(onUndo, onRedo);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(onUndo).toHaveBeenCalledTimes(1);

    cleanup();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
