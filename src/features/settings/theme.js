import { useEffect } from 'react';
import { useSelector } from 'react-redux';

export const THEMES = ['dark', 'light', 'system'];
const STORAGE_KEY = 'theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

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
            document.documentElement.dataset.theme = resolveTheme(theme, media?.matches ?? false);
        };
        apply();

        if (theme !== 'system' || !media) return;
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [theme]);
}
