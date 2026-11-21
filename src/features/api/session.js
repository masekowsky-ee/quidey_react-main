// The sign-in token on this device (localStorage 'token'): the one place that reads or writes it.
// Reading never throws (blocked storage = signed out).
export const session = {
    token() {
        try { return localStorage.getItem('token'); } catch { return null; }
    },
    set(token) {
        localStorage.setItem('token', token);
    },
    clear() {
        localStorage.removeItem('token');
    },
};

// What a sign-in token says about itself (not checked here, only to keep accounts apart on one
// device): its payload, or null when it can't be read. Callers pick their own field and fallback.
export function tokenPayload(token) {
    try {
        return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}
