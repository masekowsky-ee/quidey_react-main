// Registers the service worker that makes Quidey installable, lets it open offline and shows
// push notifications (written by pwa.js at build time). In dev, Vite serves a worker with only
// the notifications (pwa.js): a cached app would get in the way of hot reload.
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {
        // no service worker (blocked, private mode): the site simply works as before
    });
    // after the page has loaded, so installing it doesn't compete with the app's own files
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
}
