import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { applyFavicon } from './favicon';
import { VARIANT_COLORS, useColorChoice } from '../tester/variants';

export const THEMES = ['dark', 'light', 'system'];
const STORAGE_KEY = 'theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';
// --surface-bar of the default palette in each theme (index.css), for the mobile browser's bars
// where the stylesheet can't be read
const BAR_COLORS = { dark: '#0e0d0c', light: '#f5f5f3' };

// The mobile browser's bars match the header: --surface-bar of the theme and palette now on <html>
function applyBarColor(resolved) {
    const fromCss = getComputedStyle(document.documentElement).getPropertyValue('--surface-bar').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fromCss || BAR_COLORS[resolved]);
}

// The saved choice, or 'system' (the device's light or dark) when nothing valid is saved.
// localStorage can throw (private mode, blocked storage), so this never assumes it works.
export function readStoredTheme() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return THEMES.includes(stored) ? stored : 'system';
    } catch {
        return 'system';
    }
}

// 'system' follows the operating system; the others are used as they are
export function resolveTheme(theme, systemPrefersLight) {
    if (theme === 'system') return systemPrefersLight ? 'light' : 'dark';
    return theme === 'light' ? 'light' : 'dark';
}

// Applies the chosen theme to <html data-theme>, saves it, and keeps following
// the operating system while 'system' is selected
export function useApplyTheme() {
    const theme = useSelector(state => state.settings.theme);
    // the palette and accent of the interface in use: a tester's variant has its own (or the one
    // picked for it), see features/tester/variants.js
    const { variant, palette, accent } = useColorChoice();

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* not saved, still applied */ }

        const media = window.matchMedia?.(LIGHT_QUERY);
        const apply = () => {
            const resolved = resolveTheme(theme, media?.matches ?? false);
            document.documentElement.dataset.theme = resolved;
            // the colour palette (the ground): <html data-palette>, colours in index.css
            document.documentElement.dataset.palette = palette;
            applyBarColor(resolved);
        };
        apply();

        if (theme !== 'system' || !media) return;
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [theme, palette]);

    // Accent color palette (sunset, green, ...): <html data-accent>, colors in index.css ("own":
    // the variant's, in its stylesheet); the tab icon is the logo in that color
    useEffect(() => {
        document.documentElement.dataset.accent = accent;
        applyFavicon(accent, VARIANT_COLORS[variant]?.accent);
    }, [accent, variant]);
}
