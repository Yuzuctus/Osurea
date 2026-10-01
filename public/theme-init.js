// Applies an explicit theme choice before the first paint (no flash).
// Without a stored choice, the system preference decides (Agrume convention).
try {
  var theme = localStorage.getItem('osurea:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch (e) {
  /* storage unavailable: follow the system */
}
