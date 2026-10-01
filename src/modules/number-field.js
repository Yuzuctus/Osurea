/**
 * Osu!rea - Number Field Module
 * Text inputs for decimal values that stay easy to type:
 * - comma or point as the decimal separator ("42,75", "42.75", "42 mm")
 * - a value in range applies while typing; one out of range is flagged, not applied
 * - on commit (Enter, blur) an out-of-range value is brought back in range and
 *   the caller explains why; an unreadable one restores the last value
 * - ArrowUp / ArrowDown step the value (Shift ×10, Alt ÷10), Escape restores
 * @module number-field
 */

/** Live preview delay while typing, in ms */
const TYPING_DELAY = 150;

/**
 * Parse a decimal typed by a person.
 * @param {string} text
 * @returns {number|null} - null when the text is not a number (yet)
 */
export function parseDecimal(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/(mm|%|°|deg)$/i, '')
    .replace(',', '.')
    .replace(/^−/, '-');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  return Number(cleaned);
}

/**
 * @typedef {Object} FieldRange
 * @property {number} min
 * @property {number} max
 */

/**
 * @typedef {Object} FieldOptions
 * @property {() => FieldRange} range - Allowed values right now
 * @property {() => number} current - Value the field stands for
 * @property {(value: number, info: {commit: boolean, requested: number}) => void} apply
 * @property {(status: null|{kind: 'min'|'max', bound: number}) => void} [onStatus]
 *   Called with the out-of-range state while typing (null when fine)
 * @property {(text: string) => void} [onUnreadable] - Commit of a text that is not a number
 * @property {number} [step=1] - Arrow key step (Shift ×10, Alt ÷10)
 * @property {boolean} [live=true] - Apply values in range while typing
 * @property {boolean} [integer=false] - Round to whole numbers
 */

/**
 * Wire a text input as a number field.
 * @param {HTMLInputElement|null} input
 * @param {FieldOptions} options
 */
export function bindNumberField(input, options) {
  if (!input) return;
  const {
    range,
    current,
    apply,
    onStatus,
    onUnreadable,
    step = 1,
    integer = false,
    live = true,
  } = options;

  const round = value => (integer ? Math.round(value) : Math.round(value * 1000) / 1000);

  const status = value => {
    const { min, max } = range();
    if (value < min - 1e-9) return { kind: 'min', bound: min };
    if (value > max + 1e-9) return { kind: 'max', bound: max };
    return null;
  };

  const setStatus = value => {
    const state = value === null ? null : status(value);
    input.setAttribute('aria-invalid', String(Boolean(state)));
    onStatus?.(state);
    return state;
  };

  const commitValue = requested => {
    const { min, max } = range();
    const value = round(Math.min(max, Math.max(min, requested)));
    input.setAttribute('aria-invalid', 'false');
    onStatus?.(null);
    apply(value, { commit: true, requested });
  };

  // Typing: preview values in range, flag the others. A commit cancels a
  // pending preview, so it never runs after (and over) the committed value.
  let typingTimer = 0;
  input.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      const value = parseDecimal(input.value);
      if (value === null) {
        setStatus(null);
        return;
      }
      if (!setStatus(value) && live) apply(round(value), { commit: false, requested: value });
    }, TYPING_DELAY);
  });

  input.addEventListener('change', () => {
    clearTimeout(typingTimer);
    const value = parseDecimal(input.value);
    if (value === null) {
      const text = input.value.trim();
      setStatus(null);
      apply(current(), { commit: true, requested: current() });
      if (text !== '') onUnreadable?.(text);
      return;
    }
    commitValue(value);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      clearTimeout(typingTimer);
      const base = parseDecimal(input.value) ?? current();
      let delta = step;
      if (e.shiftKey) delta = step * 10;
      else if (e.altKey) delta = step / 10;
      commitValue(base + (e.key === 'ArrowUp' ? delta : -delta));
      input.select();
    } else if (e.key === 'Escape' && input.getAttribute('aria-invalid') === 'true') {
      e.preventDefault();
      clearTimeout(typingTimer);
      setStatus(null);
      apply(current(), { commit: true, requested: current() });
    }
  });

  // A click or tab into the field selects it, so typing replaces the value.
  // The mouseup that follows a focusing click would drop the selection.
  let justFocused = false;
  input.addEventListener('focus', () => {
    input.select();
    justFocused = true;
  });
  input.addEventListener('mouseup', e => {
    if (justFocused && input.selectionStart !== input.selectionEnd) e.preventDefault();
    justFocused = false;
  });
  input.addEventListener('blur', () => {
    justFocused = false;
  });
}
