import { isNativeApp } from '../native/native';

// Where Quidey runs, as the usage statistics and the API name it: the Android app, the installed
// web app (display-mode: standalone) or a browser tab
export function platform() {
    if (isNativeApp()) return 'android';
    try {
        if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) return 'pwa';
    } catch { /* no matchMedia */ }
    return 'web';
}
