// Sets the Android app up at start (main.jsx). The WebView's origin is https://app.quidey.com
// (server.hostname), the same as the web app's: the API's CORS list already allows it and
// Android's autofill offers the passwords saved for the site.
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { setShowMenu } from '../settings/settingsAction';
import { isNativeApp } from './native';

// Something that closes on Escape is open: a dialog, a popup menu, the drawer or the new-task form
function overlayOpen(state) {
    return state.settings.showMenu || state.settings.showForms
        || document.querySelector('[aria-modal="true"], [role="menu"]') !== null;
}

// Android's back button: closes what is open first (the drawer, the form, else an Escape like a
// keyboard's, which every dialog already listens to), then goes back a page, and on the first
// page sends the app to the background (not closed: a running timer stays where it is).
function onBack(store, canGoBack, minimize) {
    const state = store.getState();
    if (state.settings.showMenu) return store.dispatch(setShowMenu(false));
    if (overlayOpen(state)) {
        const modals = document.querySelectorAll('[aria-modal="true"], [role="menu"]');
        const top = modals[modals.length - 1];
        const active = document.activeElement;
        const target = top && !top.contains(active) ? top : active || document.body;
        const escape = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
        target.dispatchEvent(escape);
        return;
    }
    if (canGoBack) window.history.back();
    else minimize();
}

// The status and navigation bars' icons: light on the dark theme, dark on the light one
function followTheme() {
    const apply = () => {
        const style = document.documentElement.dataset.theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark;
        SystemBars.setStyle({ style }).catch(() => {});
    };
    apply();
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

export async function setupNativeApp(store) {
    if (!isNativeApp()) return;
    followTheme();
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => onBack(store, canGoBack, () => App.minimizeApp()));
    // back from the background: the focus clock, the lists and the socket catch up as on a
    // browser tab that gets the focus again
    App.addListener('resume', () => window.dispatchEvent(new Event('focus')));
    // Google Analytics for Firebase: whether it's there, and the remembered answer handed over
    const { setupAnalytics } = await import('./analytics');
    setupAnalytics();
    // is there a newer version of the app? (on start and whenever it comes back to the front)
    const { startUpdateChecks } = await import('./appUpdate');
    startUpdateChecks(App);
    // links, launcher shortcuts and "Share → Quidey"
    const { setupDeepLinks } = await import('./deepLinks');
    setupDeepLinks(store, App);
}
