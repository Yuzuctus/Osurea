// Applies the Yuzuctus film mode (negative / positive) and theme (dark / light) before first paint.
try {
  var film = localStorage.getItem('yuzuctus-film');
  var theme = localStorage.getItem('osurea:theme');
  var isLight = false;
  if (film === 'positive' || film === 'negative') {
    isLight = film === 'positive';
  } else if (theme === 'light' || theme === 'dark') {
    isLight = theme === 'light';
  }
  document.documentElement.dataset.film = isLight ? 'positive' : 'negative';
  document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
} catch (e) {
  document.documentElement.dataset.film = 'negative';
  document.documentElement.dataset.theme = 'dark';
}
