// Google Analytics for Firebase in the Android app, only with consent (privacy policy § 3).
// The browser never has it. The app's plugin "QuideyAnalytics" (android/…/AnalyticsPlugin.java)
// does the device's part; Android keeps collection off until setEnabled(true).
//
// Asked once per device (OnboardingPrompts: "Darf Quidey anonym mitzählen …?"), changed any time
// in Settings → App → "Nutzungsdaten". The answer is localStorage `analytics` ('granted' | 'denied';
// none = not asked yet). What goes out: the pages as names without ids or user names (screenName)
// and a few actions as plain names (trackEvent), never content, names or the account. Firebase adds
// its own: the installation's random id, device, Android version, app version, language, rough
// region (from the IP), when the app is used.
//
// Built only with the Firebase config (VITE_NATIVE_ANALYTICS=on from the Android repo's build
// script, like push); the plugin also says whether Firebase really started (isAvailable).
import { useSyncExternalStore } from 'react';
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './native';

const QuideyAnalytics = registerPlugin('QuideyAnalytics');
const KEY = 'analytics';

export const analyticsBuilt = () => isNativeApp() && import.meta.env.VITE_NATIVE_ANALYTICS === 'on';

const readChoice = () => {
    try {
        const value = localStorage.getItem(KEY);
        return value === 'granted' || value === 'denied' ? value : null;
    } catch {
        return null;
    }
};

// available: null until the plugin answered, then true / false. choice: 'granted' | 'denied' | null.
// later: the question was closed without an answer on this start
let state = { available: null, choice: readChoice(), later: false };
const listeners = new Set();
const set = (changes) => {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
};

// On every start of the app: is Firebase there, and the remembered answer handed to it again
// (so Android and the app never disagree). Quietly nothing in the browser.
export async function setupAnalytics() {
    if (!analyticsBuilt()) {
        set({ available: false });
        return;
    }
    try {
        const { available } = await QuideyAnalytics.isAvailable();
        set({ available: Boolean(available), choice: readChoice() });
        if (available) await QuideyAnalytics.setEnabled({ enabled: state.choice === 'granted' });
    } catch {
        set({ available: false });
    }
}

// The answer to the question or the setting: yes switches collection on, no switches it off
// and deletes what was collected on this device
export async function setAnalyticsConsent(granted) {
    const choice = granted ? 'granted' : 'denied';
    try { localStorage.setItem(KEY, choice); } catch { /* blocked storage: only this start */ }
    set({ choice });
    if (state.available) await QuideyAnalytics.setEnabled({ enabled: granted }).catch(() => {});
}

const counting = () => state.available === true && state.choice === 'granted';

// A page as a name: the place, never an id or a user name ('/u/anna' → 'user_profile')
const PAGES = ['calendar', 'focus', 'stats', 'profile', 'settings', 'inbox', 'feedback', 'admin', 'tester', 'fun', 'pro', 'beta', 'notes', 'study'];
const COMMUNITY_TABS = ['progress', 'sessions', 'friends', 'family'];
export function screenName(pathname) {
    const [first, second, third] = pathname.split('/').filter(Boolean);
    if (!first) return 'home';
    if (first === 'u') return 'user_profile';
    if (first === 'together') return 'session';
    if (first === 'family') return 'family';
    if (first === 'routines') return third === 'run' ? 'routine_run' : 'routines';
    if (first === 'community') return COMMUNITY_TABS.includes(second) ? `community_${second}` : 'community';
    return PAGES.includes(first) ? first : 'other';
}

export function trackScreen(pathname) {
    if (counting()) QuideyAnalytics.logScreen({ name: screenName(pathname) }).catch(() => {});
}

// An action by name, params only plain words or numbers (never anything the person wrote)
export function trackEvent(name, params = {}) {
    if (counting()) QuideyAnalytics.logEvent({ name, params }).catch(() => {});
}

// The question is due: in the app with Firebase there, not answered on this device yet, and not
// put aside on this start (closed without an answer: asked again next time)
export const analyticsQuestionDue = () => state.available === true && state.choice === null && !state.later;

export function askAnalyticsLater() {
    set({ later: true });
}

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useAnalytics = () => useSyncExternalStore(subscribe, () => state, () => state);

// Only for tests: as on a fresh start
export function resetAnalytics() {
    state = { available: null, choice: readChoice(), later: false };
}
