import { useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { SET_UI_COLORS, SET_UI_VARIANT } from '../settings/settingsActionTypes';
import { ACCENTS, PALETTE_NAMES } from '../settings/preferences';
import { selectIsTester } from '../auth/tester';
import { DESKTOP_QUERY, useMediaQuery } from '../layout/breakpoints';

// Interface variants for testers: whole looks of the app (colours, type, shapes, density), each
// with its own way of navigating and its own Home. Testers switch on /tester and rate each one
// there; everybody else always gets "current". On <html data-ui>; the styles of a variant live
// in src/ui-variants/<id>.css and load only once it is picked.
//
// nav: how the main places are reached on wide screens
//   sidebar  the menu as a sidebar (as today)
//   rail     a narrow rail of icons with their names under them
//   top      tabs in a second row of the header, the rest of the menu as a drawer
//   command  a compact sidebar plus a command bar (Ctrl/⌘ K) for jumping and doing
export const UI_VARIANTS = {
    current: { nav: 'sidebar', swatches: ['#0e0d0c', '#181716', '#f4f3f1', '#fb923c'] },
    schulheft: { nav: 'top', swatches: ['#fbfcfe', '#dbe5f5', '#2340b8', '#e2574c'] },
    lesesaal: { nav: 'rail', swatches: ['#0b1310', '#13201a', '#efe7d4', '#e3b35a'] },
    uebersicht: { nav: 'command', swatches: ['#f4f5f7', '#ffffff', '#1d1f23', '#d7000f'] },
    tafel: { nav: 'top', swatches: ['#071635', '#0d2250', '#ffffff', '#ffd23f'] },
};
export const UI_VARIANT_IDS = Object.keys(UI_VARIANTS);
export const DEFAULT_UI_VARIANT = 'current';

// each variant's stylesheet, fetched the first time it is shown
const VARIANT_STYLES = {
    schulheft: () => import('../../ui-variants/schulheft.css'),
    lesesaal: () => import('../../ui-variants/lesesaal.css'),
    uebersicht: () => import('../../ui-variants/uebersicht.css'),
    tafel: () => import('../../ui-variants/tafel.css'),
};

const STORAGE_KEY = 'uiVariant';

export function readStoredUiVariant() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return UI_VARIANT_IDS.includes(stored) ? stored : DEFAULT_UI_VARIANT;
    } catch {
        return DEFAULT_UI_VARIANT;
    }
}

export const setUiVariant = (variant) => {
    if (UI_VARIANT_IDS.includes(variant)) {
        try { localStorage.setItem(STORAGE_KEY, variant); } catch { /* only for this visit */ }
    }
    return { type: SET_UI_VARIANT, payload: variant };
};

// Colours: every variant has its own ground and accent ("own"); in the settings a tester can lay
// any colour palette and accent over it instead, remembered per variant (so "current" keeps the
// usual settings.palette / settings.accent). The swatches the settings show for "own": the
// ground in dark and light (page, card, text, as PALETTES in preferences.js) and the accent.
export const OWN_COLORS = 'own';
export const VARIANT_COLORS = {
    schulheft: { palette: { dark: ['#10141d', '#161b26', '#f2f5fb'], light: ['#fbfcfe', '#ffffff', '#131a2a'] }, accent: '#2340b8' },
    lesesaal: { palette: { dark: ['#0b1310', '#121d18', '#f3eddd'], light: ['#edf1ea', '#fbfcf8', '#10201a'] }, accent: '#e3b35a' },
    uebersicht: { palette: { dark: ['#101114', '#16171b', '#f5f6f8'], light: ['#f2f3f5', '#ffffff', '#0e1014'] }, accent: '#d7000f' },
    tafel: { palette: { dark: ['#061430', '#0c2253', '#ffffff'], light: ['#eef1f6', '#ffffff', '#091735'] }, accent: '#ffd23f' },
};

const COLORS_KEY = 'uiColors';
const validColors = (choice) => ({
    ...(PALETTE_NAMES.includes(choice?.palette) || choice?.palette === OWN_COLORS ? { palette: choice.palette } : {}),
    ...(ACCENTS.includes(choice?.accent) || choice?.accent === OWN_COLORS ? { accent: choice.accent } : {}),
});

// { [variant]: { palette?, accent? } }: what is not there is the variant's own
export function readStoredUiColors() {
    try {
        const stored = JSON.parse(localStorage.getItem(COLORS_KEY) ?? '{}');
        return Object.fromEntries(Object.keys(VARIANT_COLORS)
            .filter(variant => stored?.[variant])
            .map(variant => [variant, validColors(stored[variant])]));
    } catch {
        return {};
    }
}

// changes: { palette?, accent? } for one variant ('own' or a name from preferences.js)
export const setUiColors = (variant, changes) => (dispatch, getState) => {
    if (!VARIANT_COLORS[variant]) return;
    dispatch({ type: SET_UI_COLORS, payload: { variant, changes: validColors(changes) } });
    try { localStorage.setItem(COLORS_KEY, JSON.stringify(getState().settings.uiColors)); } catch { /* only for this visit */ }
};

export const loadVariantStyles = (variant) => VARIANT_STYLES[variant]?.().catch(() => {});

// A variant someone picked as a tester: fetched right away, so it is ready (no flash of the
// current look) once the account says they still are one
const startVariant = readStoredUiVariant();
if (startVariant !== DEFAULT_UI_VARIANT) loadVariantStyles(startVariant);

// The variant in use: the chosen one for testers, "current" for everybody else
export const selectUiVariant = (state) =>
    selectIsTester(state) ? state.settings.uiVariant : DEFAULT_UI_VARIANT;

export const useUiVariant = () => useSelector(selectUiVariant);

// The colour palette and accent in use: the variant's choice (its own colours unless one was
// picked) or, in "current", the usual settings. { variant, palette, accent }
export const selectColorChoice = (state) => {
    const variant = selectUiVariant(state);
    if (variant === DEFAULT_UI_VARIANT) return { variant, palette: state.settings.palette, accent: state.settings.accent };
    const choice = state.settings.uiColors[variant] ?? {};
    return { variant, palette: choice.palette ?? OWN_COLORS, accent: choice.accent ?? OWN_COLORS };
};

export const useColorChoice = () => useSelector(selectColorChoice, shallowEqual);

// How the main places are reached on this screen: on narrower screens every variant has the
// drawer (tablets) or the tab bar (phones)
export function useNavModel() {
    const variant = useUiVariant();
    const desktop = useMediaQuery(DESKTOP_QUERY);
    return desktop ? UI_VARIANTS[variant].nav : 'drawer';
}

// Whether the menu is the always-there sidebar (or rail) right now, not a drawer
export function useMenuDocked() {
    const nav = useNavModel();
    return nav === 'sidebar' || nav === 'rail' || nav === 'command';
}

// the mobile browser's bars match the header of the look now on <html>
function applyBarColor() {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--surface-bar').trim();
    if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

// Puts the variant on <html data-ui> (nothing for "current") once its styles are there
export function useApplyUiVariant() {
    const variant = useUiVariant();
    const theme = useSelector(state => state.settings.theme);
    useEffect(() => {
        const root = document.documentElement;
        if (variant === DEFAULT_UI_VARIANT) {
            if (root.dataset.ui) {
                delete root.dataset.ui;
                applyBarColor();
            }
            return;
        }
        let cancelled = false;
        Promise.resolve(loadVariantStyles(variant)).then(() => {
            if (cancelled) return;
            root.dataset.ui = variant;
            applyBarColor();
        });
        return () => { cancelled = true; };
    }, [variant, theme]);
}
