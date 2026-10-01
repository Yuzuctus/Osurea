/**
 * Tests for the area controller, the undo history and rotation-aware clamping
 */

import { describe, it, expect } from 'vitest';
import {
  updateAreaDimensions,
  updateRotation,
  setFullArea,
  applyRatioPreset,
  fitAreaToTablet,
} from '../../controllers/areaController.js';
import { createHistory } from '../history.js';
import { clampCentre, getHalfExtents, formatInputNumber } from '../utils.js';
import { sortFavorites } from '../favorites.js';

const makeState = (overrides = {}) => ({
  tablet: { brand: 'Wacom', model: 'CTL-472', width: 152, height: 95, isCustom: false },
  area: { width: 100, height: 62.5, x: 76, y: 47.5, radius: 0, rotation: 0 },
  areaB: { width: 80, height: 50, x: 76, y: 47.5, radius: 0, rotation: 0 },
  activeZone: 'A',
  comparisonMode: false,
  lockRatio: true,
  showGrid: true,
  ...overrides,
});

describe('updateAreaDimensions', () => {
  it('drives the height from the width with the current ratio when locked', () => {
    const state = makeState();
    updateAreaDimensions(state, 80, state.area.height, 'width');
    expect(state.area.width).toBe(80);
    expect(state.area.height).toBe(50);
  });

  it('drives the width from the height when the height is edited', () => {
    const state = makeState();
    updateAreaDimensions(state, state.area.width, 50, 'height');
    expect(state.area.width).toBe(80);
    expect(state.area.height).toBe(50);
  });

  it('keeps the ratio when the requested size does not fit', () => {
    const state = makeState();
    updateAreaDimensions(state, 1000, state.area.height, 'width');
    expect(state.area.width).toBeLessThanOrEqual(152);
    expect(state.area.height).toBeLessThanOrEqual(95);
    expect(state.area.width / state.area.height).toBeCloseTo(1.6);
  });

  it('edits each side alone when unlocked', () => {
    const state = makeState({ lockRatio: false });
    updateAreaDimensions(state, state.area.width, 40, 'height');
    expect(state.area.width).toBe(100);
    expect(state.area.height).toBe(40);
  });

  it('edits the active zone only', () => {
    const state = makeState({ activeZone: 'B', comparisonMode: true });
    updateAreaDimensions(state, 40, state.areaB.height, 'width');
    expect(state.areaB.width).toBe(40);
    expect(state.area.width).toBe(100);
  });
});

describe('setFullArea / applyRatioPreset / fitAreaToTablet', () => {
  it('grows to the tablet keeping the current ratio when locked', () => {
    const state = makeState();
    setFullArea(state);
    expect(state.area.height).toBe(95);
    expect(state.area.width).toBeCloseTo(152);
    expect(state.area.x).toBe(76);
  });

  it('applies a preset ratio from the current width', () => {
    const state = makeState();
    applyRatioPreset(state, 4 / 3);
    expect(state.area.width).toBe(100);
    expect(state.area.height).toBeCloseTo(75);
  });

  it('shrinks an area that no longer fits, keeping its ratio', () => {
    const state = makeState({ tablet: { width: 80, height: 60 } });
    fitAreaToTablet(state, 'A');
    expect(state.area.width).toBe(80);
    expect(state.area.height).toBe(50);
  });
});

describe('rotation-aware clamping', () => {
  it('computes the bounding box of a rotated area', () => {
    const { halfW, halfH } = getHalfExtents({ width: 100, height: 50, rotation: 90 });
    expect(halfW).toBeCloseTo(25);
    expect(halfH).toBeCloseTo(50);
  });

  it('keeps a rotated area on the tablet', () => {
    const pos = clampCentre(
      { width: 60, height: 20, x: 0, y: 0, rotation: 90 },
      { width: 152, height: 95 }
    );
    expect(pos.x).toBeCloseTo(10);
    expect(pos.y).toBeCloseTo(30);
  });

  it('centres an axis the rotated area cannot fit on', () => {
    const pos = clampCentre(
      { width: 150, height: 90, x: 10, y: 10, rotation: 45 },
      { width: 152, height: 95 }
    );
    expect(pos).toEqual({ x: 76, y: 47.5 });
  });

  it('re-clamps the position after a rotation', () => {
    const state = makeState({
      area: { width: 90, height: 20, x: 45, y: 47.5, radius: 0, rotation: 0 },
    });
    updateRotation(state, 90);
    expect(state.area.y).toBeGreaterThanOrEqual(45);
  });
});

describe('createHistory', () => {
  it('undoes to the previous state, not the current one', () => {
    const history = createHistory();
    history.push({ x: 1, y: 1, width: 10, height: 10 });
    history.push({ x: 2, y: 1, width: 10, height: 10 });
    expect(history.undo().x).toBe(1);
    expect(history.undo()).toBeNull();
  });

  it('redoes what was undone and clears redo on a new change', () => {
    const history = createHistory();
    history.push({ x: 1 });
    history.push({ x: 2 });
    history.undo();
    expect(history.redo().x).toBe(2);
    history.undo();
    history.push({ x: 3 });
    expect(history.canRedo()).toBe(false);
  });

  it('ignores a push identical to the latest entry', () => {
    const history = createHistory();
    history.push({ x: 1 });
    history.push({ x: 1 });
    expect(history.canUndo()).toBe(false);
  });

  it('respects its size limit', () => {
    const history = createHistory(3);
    for (let x = 0; x < 10; x++) history.push({ x });
    expect(history.undo().x).toBe(8);
    expect(history.undo().x).toBe(7);
    expect(history.undo()).toBeNull();
  });
});

describe('formatInputNumber', () => {
  it('keeps up to three decimals without trailing zeros', () => {
    expect(formatInputNumber(76)).toBe('76');
    expect(formatInputNumber(62.5)).toBe('62.5');
    expect(formatInputNumber(47.123456)).toBe('47.123');
    expect(formatInputNumber(NaN)).toBe('');
  });
});

describe('sortFavorites', () => {
  const favs = [
    {
      name: 'b',
      createdAt: '2026-01-02',
      tablet: { brand: 'W', model: '1' },
      area: { width: 10, height: 10 },
    },
    {
      name: 'a',
      createdAt: '2026-01-03',
      tablet: { brand: 'H', model: '1' },
      area: { width: 20, height: 10 },
    },
    {
      name: 'c',
      createdAt: '2026-01-01',
      tablet: { brand: 'X', model: '1' },
      area: { width: 5, height: 5 },
    },
  ];

  it('sorts by date in both directions', () => {
    expect(sortFavorites(favs, 'date', 'desc').map(f => f.name)).toEqual(['a', 'b', 'c']);
    expect(sortFavorites(favs, 'date', 'asc').map(f => f.name)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by name and by size', () => {
    expect(sortFavorites(favs, 'name', 'asc').map(f => f.name)).toEqual(['a', 'b', 'c']);
    expect(sortFavorites(favs, 'area', 'desc').map(f => f.name)).toEqual(['a', 'b', 'c']);
  });
});

describe('parseDecimal', () => {
  it('reads comma and point decimals, units and spaces', async () => {
    const { parseDecimal } = await import('../number-field.js');
    expect(parseDecimal('42,75')).toBe(42.75);
    expect(parseDecimal('42.75')).toBe(42.75);
    expect(parseDecimal(' 42 mm')).toBe(42);
    expect(parseDecimal('-90°')).toBe(-90);
    expect(parseDecimal(',5')).toBe(0.5);
  });

  it('returns null for text that is not a number yet', async () => {
    const { parseDecimal } = await import('../number-field.js');
    for (const text of ['', '-', 'abc', '4,2,1', '1e5']) expect(parseDecimal(text)).toBeNull();
  });
});

describe('size limits', () => {
  it('limits a locked width by the height it would give', async () => {
    const { getSizeLimits } = await import('../../controllers/areaController.js');
    const state = makeState({
      area: { width: 90, height: 90, x: 76, y: 47.5, radius: 0, rotation: 0 },
    });
    const { width } = getSizeLimits(state);
    expect(width.max).toBeCloseTo(95);
    expect(width.reason).toBe('ratio');
  });

  it('uses the tablet size when unlocked and straight', async () => {
    const { getSizeLimits } = await import('../../controllers/areaController.js');
    const limits = getSizeLimits(makeState({ lockRatio: false }));
    expect(limits.width).toMatchObject({ max: 152, reason: 'tablet' });
    expect(limits.height).toMatchObject({ max: 95, reason: 'tablet' });
  });

  it('shrinks the limits under a rotation, and the max still fits', async () => {
    const { getSizeLimits, setAreaSide } = await import('../../controllers/areaController.js');
    const state = makeState({
      area: { width: 50, height: 30, x: 76, y: 47.5, radius: 0, rotation: 45 },
    });
    const { width } = getSizeLimits(state);
    expect(width.reason).toBe('rotation');
    setAreaSide(state, 'width', 1000);
    const { halfW, halfH } = getHalfExtents(state.area);
    expect(halfW * 2).toBeLessThanOrEqual(152 + 1e-6);
    expect(halfH * 2).toBeLessThanOrEqual(95 + 1e-6);
  });

  it('gives the centre range of the area', async () => {
    const { getPositionLimits } = await import('../../controllers/areaController.js');
    const { x, y } = getPositionLimits(makeState());
    expect(x).toEqual({ min: 50, max: 102 });
    expect(y).toEqual({ min: 31.25, max: 63.75 });
  });
});

describe('swapDimensions', () => {
  it('swaps and shrinks to fit, keeping the swapped ratio', async () => {
    const { swapDimensions } = await import('../../controllers/areaController.js');
    const state = makeState({ lockRatio: false });
    const shrunk = swapDimensions(state);
    expect(shrunk).toBe(true);
    expect(state.area.height).toBeCloseTo(95);
    expect(state.area.width / state.area.height).toBeCloseTo(62.5 / 100);
  });
});

describe('updateRotation', () => {
  it('reports when the area had to shrink', () => {
    const state = makeState({
      area: { width: 152, height: 95, x: 76, y: 47.5, radius: 0, rotation: 0 },
    });
    const result = updateRotation(state, 30);
    expect(result.shrunk).toBe(true);
    const { halfW, halfH } = getHalfExtents(state.area);
    expect(halfW * 2).toBeLessThanOrEqual(152 + 1e-6);
    expect(halfH * 2).toBeLessThanOrEqual(95 + 1e-6);
  });
});
