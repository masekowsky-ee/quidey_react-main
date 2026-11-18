// Ways into the Android app from outside, all ending in the same web app:
//  - Android App Links: a link to https://app.quidey.com/… (an email, a message) opens the app on
//    that page (needs /.well-known/assetlinks.json, public/.well-known/);
//  - the launcher's shortcuts (long press on the icon): new task, focus, calendar. They are links
//    too: https://app.quidey.com/?new=task, /focus, /calendar (res/xml/shortcuts.xml);
//  - "Share → Quidey" from any app: the text becomes the first line of a new task (plugin
//    QuideyShare, ShareTargetPlugin.java).
// In the browser nothing here runs.
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './native';
import { showForms } from '../settings/settingsAction';
import { setPendingText } from './sharedText';

const QuideyShare = registerPlugin('QuideyShare');
const HOST = 'app.quidey.com';

// The path inside the app a link points to, and what to do on arrival; null for a link that
// isn't ours.
export function routeOf(link) {
    let url;
    try { url = new URL(link); } catch { return null; }
    if (url.protocol !== 'https:' || url.hostname !== HOST) return null;
    const params = new URLSearchParams(url.search);
    const openForm = params.get('new') === 'task';
    params.delete('new');
    const query = params.toString();
    return { path: `${url.pathname}${query ? `?${query}` : ''}${url.hash}`, openForm };
}

function go(store, link) {
    const route = routeOf(link);
    if (!route) return;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (route.path !== here) {
        // the router listens to popstate: this is a navigation without a reload
        window.history.pushState({}, '', route.path);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }
    if (route.openForm) store.dispatch(showForms(true));
}

function share(store, text) {
    if (!text) return;
    setPendingText(text);
    // a form that is open already keeps what was typed: close and open it again with the text
    store.dispatch(showForms(false));
    store.dispatch(showForms(true));
}

export async function setupDeepLinks(store, App) {
    if (!isNativeApp()) return;
    App.addListener('appUrlOpen', ({ url }) => go(store, url));
    const launch = await App.getLaunchUrl?.().catch(() => null);
    if (launch?.url) go(store, launch.url);

    try {
        QuideyShare.addListener('shared', ({ text }) => share(store, text));
        const { text } = await QuideyShare.takePending();
        share(store, text);
    } catch {
        // an app built before the plugin
    }
}
