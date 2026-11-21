import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { GUEST_PATHS } from '../app/routeTable.js';
import { OPEN_AUTH_EVENT, openAuth } from '../api/events';

// Quidey opens for everybody; what needs an account asks for one. Anything that does asks
// openAuth() for the sign-in / sign-up window (components/auth/AuthDialog.jsx listens).
// A plain window event, so the API layer can ask too without reaching the store.
// (OPEN_AUTH_EVENT and openAuth live in features/api/events.js, re-exported here)
export { OPEN_AUTH_EVENT, openAuth };

// The pages a visitor without an account may look at (features/app/routeTable.js, guest: true);
// every other address asks them to sign in
export const isGuestPath = (pathname) => GUEST_PATHS.includes(pathname);

// requireAccount(action?): with an account it runs action and answers true; without one it
// opens the window and answers false.
export function useRequireAccount() {
    const token = useSelector((state) => state.auth.token);
    return useCallback((action) => {
        if (!token) { openAuth(); return false; }
        action?.();
        return true;
    }, [token]);
}

// The address typed into the landing page's email line comes along as #email=… (a hash never
// reaches a server). Read once, then taken out of the address bar.
export function takeEmailFromHash() {
    const match = window.location.hash.match(/^#email=([^&]*)/);
    if (!match) return '';
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
    try { return decodeURIComponent(match[1]); } catch { return ''; }
}
