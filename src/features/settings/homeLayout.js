// Home page layout: 'solo' (own tasks and timer) or 'team' (a workspace for shared sessions).
// Remembered in localStorage like the theme; storage can throw, so this never assumes it works.

export const HOME_LAYOUTS = ['solo', 'team'];
const STORAGE_KEY = 'homeLayout';

export function readStoredHomeLayout() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return HOME_LAYOUTS.includes(stored) ? stored : 'solo';
    } catch {
        return 'solo';
    }
}

export function storeHomeLayout(layout) {
    try { localStorage.setItem(STORAGE_KEY, layout); } catch { /* still applied, just not remembered */ }
}
