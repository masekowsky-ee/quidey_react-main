// Addresses of the legal pages (LegalPage.jsx); App.jsx opens them before any sign-in check.
// /kuendigen: "Verträge hier kündigen" (§ 312k BGB), cancelling Quidey Pro without signing in.
export const CANCEL_PATH = '/kuendigen';
export const LEGAL_PATHS = ['/impressum', '/datenschutz', '/nutzungsbedingungen', '/kontakt', CANCEL_PATH];
