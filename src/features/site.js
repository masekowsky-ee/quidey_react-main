// The landing page is its own site (repo quidey_landing, on quidey.com); the app lives on
// app.quidey.com. The landing page's "Anmelden" / "Beta-Platz sichern" lead to /signin and /signup.
export const LANDING_URL = import.meta.env.VITE_LANDING_URL || 'https://quidey.com';
