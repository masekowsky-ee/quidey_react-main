// Loaded by index.html before the app (a file, not an inline script, so the
// Content-Security-Policy can forbid inline scripts).
// Sets the saved theme before the first paint, so light mode doesn't flash dark on load.
// Same rules as src/features/settings/theme.js.
try {
  var theme = localStorage.getItem('theme');
  var light = theme === 'light' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  // accent color palette; unknown values simply fall back to the default green in CSS
  document.documentElement.dataset.accent = localStorage.getItem('accent') || 'green';
} catch {
  // storage blocked (private mode): the CSS default, dark green, stays
}
