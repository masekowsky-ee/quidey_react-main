import { useSelector, shallowEqual } from 'react-redux';
import { selectIsTester } from '../auth/tester';
import { read } from '../storedSetting';
import { ACCENTS, PALETTE_NAMES } from './preferences';

// Which colours the interface shows: the settings' palette and accent, or (for testers) the ones
// of the interface variant in use. Lives in settings so the theme doesn't depend on the tester's
// variants (features/tester/variants.js builds on this, not the other way round).

export const DEFAULT_UI_VARIANT = 'current';

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

export const UI_VARIANT_IDS = [DEFAULT_UI_VARIANT, ...Object.keys(VARIANT_COLORS)];

export const readStoredUiVariant = () => read('uiVariant', { allowed: UI_VARIANT_IDS, fallback: DEFAULT_UI_VARIANT });

export const validColors = (choice) => ({
    ...(PALETTE_NAMES.includes(choice?.palette) || choice?.palette === OWN_COLORS ? { palette: choice.palette } : {}),
    ...(ACCENTS.includes(choice?.accent) || choice?.accent === OWN_COLORS ? { accent: choice.accent } : {}),
});

// { [variant]: { palette?, accent? } }: what is not there is the variant's own
export const readStoredUiColors = () => read('uiColors', {
    parse: (text) => {
        const stored = JSON.parse(text ?? '{}');
        return Object.fromEntries(Object.keys(VARIANT_COLORS)
            .filter(variant => stored?.[variant])
            .map(variant => [variant, validColors(stored[variant])]));
    },
    fallback: {},
});

// The variant in use: the chosen one for testers, "current" for everybody else
export const selectUiVariant = (state) =>
    selectIsTester(state) ? state.settings.uiVariant : DEFAULT_UI_VARIANT;

// The colour palette and accent in use: the variant's choice (its own colours unless one was
// picked) or, in "current", the usual settings. { variant, palette, accent }
export const selectColorChoice = (state) => {
    const variant = selectUiVariant(state);
    if (variant === DEFAULT_UI_VARIANT) return { variant, palette: state.settings.palette, accent: state.settings.accent };
    const choice = state.settings.uiColors[variant] ?? {};
    return { variant, palette: choice.palette ?? OWN_COLORS, accent: choice.accent ?? OWN_COLORS };
};

export const useColorChoice = () => useSelector(selectColorChoice, shallowEqual);

// --surface-bar of the default palette in each theme (index.css), for the mobile browser's bars
// where the stylesheet can't be read
const BAR_COLORS = { dark: '#0e0d0c', light: '#f5f5f3' };

// The mobile browser's bars match the header: --surface-bar of the theme and palette now on <html>
// (`resolved`, 'dark' | 'light', is only for when the stylesheet can't be read)
export function applyBarColor(resolved) {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--surface-bar').trim() || BAR_COLORS[resolved];
    if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}
