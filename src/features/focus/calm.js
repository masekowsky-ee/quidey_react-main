// Calm mode: while a focus round runs in the Fokusraum, the app's navigation, the tab bar and the
// add button step back (App sets data-calm on the shell, AppShell.module.css fades them); the
// Fokusraum shows one quiet "Zurück zur App" instead. On by default, switched in
// Fokus-Einstellungen (localStorage focusCalm 'off'). Everywhere: it only hides, nothing is tracked.

import { useSelector } from 'react-redux';
import { inFocusRound } from './away';
import { createStoredValue } from '../storedSetting';
import { paths } from '../app/navTable';

const calm = createStoredValue('focusCalm', { fallback: true, parse: (text) => text !== 'off', encode: (on) => (on ? 'on' : 'off') });
export const readCalm = calm.get;
export const setCalm = calm.set;
export const useCalmSetting = calm.useValue;

export const isCalm = (state, pathname, on) => on && pathname === paths.focus && inFocusRound(state) && state.session.timer.active;

export function useCalm(pathname) {
    const on = useCalmSetting();
    return useSelector(state => isCalm(state, pathname, on));
}
