// Addresses of the legal pages (LegalPage.jsx); App.jsx opens them before any sign-in check.
// /kuendigen: "Verträge hier kündigen" (§ 312k BGB), cancelling Quidey Pro without signing in;
// only while Pro is built in (features/pro/flag.js): without contracts there is nothing to cancel.
import { proBuilt } from '../features/pro/flag';

export const CANCEL_PATH = '/kuendigen';
export const LEGAL_PATHS = ['/impressum', '/datenschutz', '/nutzungsbedingungen', '/kontakt', ...(proBuilt() ? [CANCEL_PATH] : [])];
