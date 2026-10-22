import { useCallback, useSyncExternalStore } from 'react';

// The app's layout widths, the same numbers as in AppShell.module.css:
// - desktop: the menu is a sidebar that is always there, Home gets its focus column
// - phone: a tab bar at the bottom holds the main pages, "More" opens the menu
export const DESKTOP_QUERY = '(min-width: 1100px)';
export const PHONE_QUERY = '(max-width: 720px)';

// Whether a media query matches, kept current while the window changes size.
// Without matchMedia (tests) it never matches.
export function useMediaQuery(query) {
    const subscribe = useCallback((onChange) => {
        if (typeof window === 'undefined' || !window.matchMedia) return () => {};
        const list = window.matchMedia(query);
        list.addEventListener('change', onChange);
        return () => list.removeEventListener('change', onChange);
    }, [query]);
    const read = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
    return useSyncExternalStore(subscribe, read, () => false);
}
