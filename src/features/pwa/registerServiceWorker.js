// Registers the service worker that makes Quidey installable and lets it open offline
// (written by pwa.js at build time). Only in the built app: in dev there is no sw.js, and a
// cached app would get in the way of Vite's hot reload.
export function registerServiceWorker() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {
        // no service worker (blocked, private mode): the site simply works as before
    });
    // after the page has loaded, so installing it doesn't compete with the app's own files
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
}
