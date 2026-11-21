// What the API layer announces on the window. App (and the dialogs) listen; nothing here knows them.

// Fired when the server says the app is only for pro users and testers (closed beta),
// or that something is only for testers
export const PRO_REQUIRED_EVENT = 'quidey:pro-required';
export const ACCESS_CODES = ['PRO_REQUIRED', 'TESTER_REQUIRED'];

// Fired when the server no longer accepts my login (expired, password changed elsewhere,
// "sign out everywhere"): App signs out
export const SIGNED_OUT_EVENT = 'quidey:signed-out';
export const SIGNED_OUT_CODES = ['TOKEN_REVOKED', 'TOKEN_INVALID'];

// Fired when the free plan is full (403 LIMIT_REACHED, after the beta): detail { limit, max }.
// App shows the friendly "this needs Quidey Pro" dialog (components/pro/LimitDialog.jsx).
export const LIMIT_EVENT = 'quidey:limit-reached';
