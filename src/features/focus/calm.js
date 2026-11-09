// Calm mode: while a focus round runs in the Fokusraum, the app's navigation, the tab bar and the
// add button step back (App sets data-calm on the shell, AppShell.module.css fades them); the
// Fokusraum shows one quiet "Zurück zur App" instead. On by default, switched in
// Fokus-Einstellungen (localStorage focusCalm 'off'). Everywhere: it only hides, nothing is tracked.

import { useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { inFocusRound } from './away';

const KEY = 'focusCalm';
const listeners = new Set();

export function readCalm() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setCalm(on) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* only for this visit */ }
    listeners.forEach(listener => listener());
}

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const useCalmSetting = () => useSyncExternalStore(subscribe, readCalm, readCalm);

// the round runs (not paused) in the Fokusraum, and calm mode is on
export const isCalm = (state, pathname, on) => on && pathname === '/focus' && inFocusRound(state) && state.session.timer.active;

export function useCalm(pathname) {
    const on = useCalmSetting();
    return useSelector(state => isCalm(state, pathname, on));
}
