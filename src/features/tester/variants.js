import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { SET_UI_COLORS, SET_UI_VARIANT } from '../settings/settingsActionTypes';
import { DEFAULT_UI_VARIANT, OWN_COLORS, UI_VARIANT_IDS, VARIANT_COLORS, applyBarColor, readStoredUiColors, readStoredUiVariant, selectColorChoice, selectUiVariant, useColorChoice, validColors } from '../settings/colors';
import { write } from '../storedSetting';
import { DESKTOP_QUERY, useMediaQuery } from '../layout/breakpoints';

// Interface variants for testers: whole looks of the app (colours, type, shapes, density), each
// with its own way of navigating and its own Home. Testers switch on /tester and rate each one
// there; everybody else always gets "current". On <html data-ui>; the styles of a variant live
// in src/ui-variants/<id>.css and load only once it is picked.
//
// nav: how the main places are reached on wide screens
//   rail     a narrow rail of icons with their names under them
//   top      tabs in a second row of the header, the rest of the menu as a drawer
//   command  a compact sidebar plus a command bar (Ctrl/⌘ K) for jumping and doing
export const UI_VARIANTS = {
    current: { nav: 'bar', swatches: ['#0e0d0c', '#181716', '#f4f3f1', '#fb923c'] },
    schulheft: { nav: 'top', swatches: ['#fbfcfe', '#dbe5f5', '#2340b8', '#e2574c'] },
    lesesaal: { nav: 'rail', swatches: ['#0b1310', '#13201a', '#efe7d4', '#e3b35a'] },
    uebersicht: { nav: 'command', swatches: ['#f4f5f7', '#ffffff', '#1d1f23', '#d7000f'] },
    tafel: { nav: 'top', swatches: ['#071635', '#0d2250', '#ffffff', '#ffd23f'] },
};
// the colour choice lives in settings (the theme needs it); re-exported here for the variants' users
export { DEFAULT_UI_VARIANT, OWN_COLORS, UI_VARIANT_IDS, VARIANT_COLORS, readStoredUiColors, readStoredUiVariant, selectColorChoice, selectUiVariant, useColorChoice };

// each variant's stylesheet, fetched the first time it is shown
const VARIANT_STYLES = {
    schulheft: () => import('../../ui-variants/schulheft.css'),
    lesesaal: () => import('../../ui-variants/lesesaal.css'),
    uebersicht: () => import('../../ui-variants/uebersicht.css'),
    tafel: () => import('../../ui-variants/tafel.css'),
};

const STORAGE_KEY = 'uiVariant';

export const setUiVariant = (variant) => {
    if (UI_VARIANT_IDS.includes(variant)) write(STORAGE_KEY, variant);
    return { type: SET_UI_VARIANT, payload: variant };
};

const COLORS_KEY = 'uiColors';

// changes: { palette?, accent? } for one variant ('own' or a name from preferences.js)
export const setUiColors = (variant, changes) => (dispatch, getState) => {
    if (!VARIANT_COLORS[variant]) return;
    dispatch({ type: SET_UI_COLORS, payload: { variant, changes: validColors(changes) } });
    write(COLORS_KEY, JSON.stringify(getState().settings.uiColors));
};

const loadVariantStyles = (variant) => VARIANT_STYLES[variant]?.().catch(() => {});

// A variant someone picked as a tester: fetched right away, so it is ready (no flash of the
// current look) once the account says they still are one
const startVariant = readStoredUiVariant();
if (startVariant !== DEFAULT_UI_VARIANT) loadVariantStyles(startVariant);

export const useUiVariant = () => useSelector(selectUiVariant);

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
    return nav === 'rail' || nav === 'command';
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
