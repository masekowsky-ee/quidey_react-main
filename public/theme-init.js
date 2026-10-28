// Loaded by index.html before the app (a file, not an inline script, so the
// Content-Security-Policy can forbid inline scripts).
// Sets the saved theme before the first paint, so light mode doesn't flash dark on load.
// Same rules as src/features/settings/theme.js.
try {
  var theme = localStorage.getItem('theme');
  var light = theme === 'light' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  // accent color palette; unknown values simply fall back to the CSS default, Abendrot (sunset)
  document.documentElement.dataset.accent = localStorage.getItem('accent') || 'sunset';
  // colour palette (the ground: warm, graphite, nord, ...); unknown values keep the default, warm
  document.documentElement.dataset.palette = localStorage.getItem('palette') || 'warm';
  // amount of motion (features/settings/motion.js): saved choice, else the system's "reduce motion"
  var motion = localStorage.getItem('motion');
  document.documentElement.dataset.motion = ['minimal', 'normal', 'extreme'].indexOf(motion) >= 0 ? motion
    : (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'minimal' : 'normal');
  // the page's language: the one picked in the settings, else the device's (German or English),
  // like readStoredLanguage in src/features/settings/preferences.js
  var language = localStorage.getItem('language');
  if (language !== 'de' && language !== 'en') {
    language = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  }
  document.documentElement.lang = language;
  // which skeleton the first paint shows (public/boot.css): Home, another page, or the sign-in
  document.documentElement.dataset.boot = !localStorage.getItem('token') ? 'gate'
    : window.location.pathname === '/' ? 'home' : 'page';
} catch {
  // storage blocked (private mode): the CSS default, dark Abendrot, stays; no account to show
  document.documentElement.dataset.boot = 'gate';
}
