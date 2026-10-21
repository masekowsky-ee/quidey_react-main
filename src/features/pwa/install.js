// "Install as app" for the settings. Chrome / Edge / Android offer installing through the
// beforeinstallprompt event, which fires once, early, often before the settings are open — so
// it is caught at startup (listenForInstallPrompt in main.jsx) and kept here. Safari on
// iPhone / iPad has no such event: there the settings explain the share menu instead.
import { useSyncExternalStore } from 'react';

let deferredPrompt = null;
let installed = false;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

const runsAsApp = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function listenForInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
        // no mini-infobar of the browser's own: the settings offer it instead
        event.preventDefault();
        deferredPrompt = event;
        notify();
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        installed = true;
        notify();
    });
}

// 'installed' (already runs as app), 'prompt' (the browser can install it on a click),
// 'ios' (Safari on iPhone / iPad: via the share menu) or 'unavailable'
export function installState() {
    if (installed || runsAsApp()) return 'installed';
    if (deferredPrompt) return 'prompt';
    const ua = window.navigator.userAgent;
    // iPadOS reports itself as a Mac, but with touch
    const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
    if (apple && !/CriOS|FxiOS|EdgiOS/.test(ua)) return 'ios';
    return 'unavailable';
}

// Shows the browser's install dialog; the event can only be used once
export async function promptInstall() {
    const event = deferredPrompt;
    if (!event) return;
    deferredPrompt = null;
    event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') installed = true;
    notify();
}

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export function useInstallState() {
    return useSyncExternalStore(subscribe, installState);
}
