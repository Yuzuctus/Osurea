/**
 * Minimal logger wrapper to keep production code decoupled from direct console usage.
 */

function getConsole() {
  return globalThis?.['console'];
}

export function logWarn(...args) {
  getConsole()?.warn?.(...args);
}

export function logError(...args) {
  getConsole()?.error?.(...args);
}

