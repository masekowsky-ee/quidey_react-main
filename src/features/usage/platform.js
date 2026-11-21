import { isNativeApp } from '../native/native';

// The installed web app: a window of its own (display-mode: standalone), or iOS' home-screen app
export function isStandalone() {
    try {
        return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
    } catch {
        return false;
    }
}

export const runsAsApp = () => isNativeApp() || isStandalone();

// Where Quidey runs, as the usage statistics and the API name it: the Android app, the installed
// web app (display-mode: standalone) or a browser tab
export function platform() {
    if (isNativeApp()) return 'android';
    try {
        if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) return 'pwa';
    } catch { /* no matchMedia */ }
    return 'web';
}
