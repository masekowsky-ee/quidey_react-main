import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { applyFavicon } from './favicon';

export const THEMES = ['dark', 'light', 'system'];
const STORAGE_KEY = 'theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';
// --surface-bar of each theme (index.css), for the mobile browser's bars
const BAR_COLORS = { dark: '#2b2b2b', light: '#ffffff' };

// The saved choice, or 'dark' (the app's original look) when nothing valid is saved.
// localStorage can throw (private mode, blocked storage), so this never assumes it works.
export function readStoredTheme() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return THEMES.includes(stored) ? stored : 'dark';
    } catch {
        return 'dark';
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

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* not saved, still applied */ }

        const media = window.matchMedia?.(LIGHT_QUERY);
        const apply = () => {
            const resolved = resolveTheme(theme, media?.matches ?? false);
            document.documentElement.dataset.theme = resolved;
            // the mobile browser's bars match the header (--surface-bar)
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLORS[resolved]);
        };
        apply();

        if (theme !== 'system' || !media) return;
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [theme]);

    // Accent color palette (sunset, green, ...): <html data-accent>, colors in index.css;
    // the tab icon is the logo in that color
    const accent = useSelector(state => state.settings.accent);
    useEffect(() => {
        document.documentElement.dataset.accent = accent;
        applyFavicon(accent);
    }, [accent]);
}
