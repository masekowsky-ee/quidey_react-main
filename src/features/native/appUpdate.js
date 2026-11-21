// Updating the Android app. The web layer inside it is bundled, so a new version of anything
// (also of this web app) reaches phones only as a new app from Google Play. Two sources say
// whether there is one:
//   - our server, GET /api/app-version?platform=android&version=<build number>: the newest build,
//     and the oldest one that still works (older ones must update: `required`);
//   - Google Play itself, through the app's plugin QuideyUpdate (UpdatePlugin.java in
//     quidey_android): whether Play has a newer build for this phone and may install it from
//     inside the app (a flexible update downloads in the background, an immediate one takes over
//     the screen). It answers only for an app installed from Play; for a downloaded APK the person
//     is sent to the download page instead.
//
// state.status: 'none' | 'available' | 'required' | 'downloading' | 'ready'
// Everything is a no-op in the browser.
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './native';
import { rawFetch } from '../api/api';

const QuideyUpdate = registerPlugin('QuideyUpdate');

const DISMISS_KEY = 'updateDismissed';
// "Später" hides the offer for this long (a required update can't be put off)
export const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;
const RECHECK_MS = 6 * 60 * 60 * 1000;
// Play marks an update that must not wait with priority 5 (set in the Play Console / API)
const PLAY_REQUIRED_PRIORITY = 5;

const initial = { status: 'none', latest: null, storeUrl: null, fromPlay: false, error: false };
let state = initial;
const listeners = new Set();
let lastCheck = 0;

const set = (change) => {
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
};
export const subscribeUpdate = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const updateState = () => state;

// What the two answers add up to. `server` is the API's answer (or null), `play` the plugin's
// (or null: not installed from Play, or an older app without the plugin).
export function decideUpdate(server, play, { dismissedAt = 0, dismissedFor = null, now = Date.now() } = {}) {
    const required = Boolean(server?.mustUpdate) || (Boolean(play?.available) && (play.priority ?? 0) >= PLAY_REQUIRED_PRIORITY);
    const available = Boolean(server?.updateAvailable) || Boolean(play?.available);
    const latest = server?.latest?.code ?? play?.versionCode ?? null;
    if (required) return 'required';
    if (!available) return 'none';
    // put off for a while, but a newer build than the one put off is offered again
    if (dismissedFor !== null && dismissedFor === latest && now - dismissedAt < DISMISS_MS) return 'none';
    return 'available';
}

function readDismissed() {
    try {
        const saved = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? 'null');
        return saved ? { dismissedAt: saved.at, dismissedFor: saved.code } : {};
    } catch {
        return {};
    }
}

async function buildNumber() {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return info.build;
}

async function askServer(build) {
    try {
        // rawFetch (no offline layer): this is public, it must also work signed out (no token), and it must never be answered from the offline copy
        const response = await rawFetch(`/api/app-version?platform=android&version=${encodeURIComponent(build)}`, {}, null);
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

async function askPlay() {
    try {
        return await QuideyUpdate.check();
    } catch {
        return null;
    }
}

// Asks both. `force` skips the "not more often than" rule.
async function checkForUpdate({ force = false } = {}) {
    if (!isNativeApp()) return state.status;
    if (state.status === 'downloading' || state.status === 'ready') return state.status;
    if (!force && Date.now() - lastCheck < RECHECK_MS && state.status !== 'required') return state.status;
    lastCheck = Date.now();
    try {
        const [server, play] = await Promise.all([buildNumber().then(askServer), askPlay()]);
        const status = play?.downloaded ? 'ready' : decideUpdate(server, play, readDismissed());
        set({ status, latest: server?.latest ?? (play ? { code: play.versionCode, name: null } : null), storeUrl: server?.storeUrl ?? null, fromPlay: Boolean(play), error: false });
    } catch {
        // no answer is no news: whatever was known stays
    }
    return state.status;
}

export function dismissUpdate() {
    if (state.status !== 'available') return;
    try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify({ code: state.latest?.code ?? null, at: Date.now() }));
    } catch { /* the offer simply comes back next time */ }
    set({ status: 'none' });
}

export async function startUpdate() {
    if (!isNativeApp()) return;
    const required = state.status === 'required';
    if (state.fromPlay) {
        try {
            const { result } = await QuideyUpdate.start({ type: required ? 'immediate' : 'flexible' });
            if (result === 'ok' && !required) set({ status: 'downloading', error: false });
            else if (result !== 'ok') set({ error: true });
            return;
        } catch {
            // Play refused (e.g. this kind of update isn't allowed right now): the store page does it
        }
    }
    if (state.storeUrl) window.open(state.storeUrl, '_blank');
    else set({ error: true });
}

export async function finishUpdate() {
    try {
        await QuideyUpdate.complete();
    } catch {
        set({ error: true });
    }
}

// from setupNativeApp (setup.js): on start, and whenever the app comes back to the front
export async function startUpdateChecks(App) {
    if (!isNativeApp()) return;
    QuideyUpdate.addListener?.('downloaded', () => set({ status: 'ready', error: false }));
    App.addListener('resume', () => { checkForUpdate().catch(() => {}); });
    checkForUpdate({ force: true }).catch(() => {});
}

// for tests
