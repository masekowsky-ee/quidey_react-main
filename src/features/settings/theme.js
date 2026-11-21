import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { applyFavicon } from './favicon';
import { VARIANT_COLORS, applyBarColor, useColorChoice } from './colors';
import { read, write } from '../storedSetting';

export const THEMES = ['dark', 'light', 'system'];
const STORAGE_KEY = 'theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';
// The saved choice, or 'system' (the device's light or dark) when nothing valid is saved.
// localStorage can throw (private mode, blocked storage), so this never assumes it works.
export const readStoredTheme = () => read(STORAGE_KEY, { allowed: THEMES, fallback: 'system' });

export function resolveTheme(theme, systemPrefersLight) {
    if (theme === 'system') return systemPrefersLight ? 'light' : 'dark';
    return theme === 'light' ? 'light' : 'dark';
}

export function useApplyTheme() {
    const theme = useSelector(state => state.settings.theme);
    // the palette and accent of the interface in use: a tester's variant has its own (or the one
    // picked for it), see features/tester/variants.js
    const { variant, palette, accent } = useColorChoice();

    useEffect(() => {
        write(STORAGE_KEY, theme); // not saved when storage is blocked, still applied

        const media = window.matchMedia?.(LIGHT_QUERY);
        const set = (resolved) => {
            document.documentElement.dataset.theme = resolved;
            document.documentElement.dataset.palette = palette;
            applyBarColor(resolved);
        };
        const apply = () => {
            const resolved = resolveTheme(theme, media?.matches ?? false);
            const before = document.documentElement.dataset.theme;
            // light <-> dark eases over (a cross-fade, index.css) instead of a flash of brightness;
            // the first paint and a change of palette alone just switch
            if (before && before !== resolved && document.startViewTransition && !document.hidden) {
                document.startViewTransition(() => set(resolved));
            } else set(resolved);
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
