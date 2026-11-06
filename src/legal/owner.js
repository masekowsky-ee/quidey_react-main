// Who runs Quidey: the details the Impressum (§ 5 DDG), the privacy policy (Art. 13 DSGVO),
// the terms and the copyright notice show. Fill in every TODO before going live; until then the
// pages show the placeholders in red, and the console warns.
//
// Required by law: full name, a postal address where you can be served (no P.O. box) and two
// ways to reach you quickly, one of them electronic (email + phone, or email + contact form).

export const OWNER = {
    // Optional: a business address service ("Impressum-Service") instead of your home address.
    // Its name goes here (e.g. 'c/o Beispiel Adressservice GmbH'), its address in street/city.
    careOf: '',
    name: 'Eesge Masekowsky',
    street: 'Altfelder Weg 12',
    city: '25718 Friedrichskoog',
    country: 'Deutschland',
    email: 'masekowsky.ee@gmail.com',
    phone: '---',
};

// Services that process data for Quidey (named in the privacy policy).
export const PROCESSORS = {
    // the website (wrangler.jsonc: Cloudflare Workers)
    frontendHost: 'Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA',
    // the server running the API and the database
    backendHost: 'STRATO AG, Otto-Ostrowski-Straße 7, 10249 Berlin',
    // the mail service sending the confirmation links (SMTP_HOST in the backend's .env: smtp.resend.com)
    mailProvider: 'Resend, Inc., 2261 Market Street #5039, San Francisco, CA 94114, USA',
    // Quidey Pro on the web (backend utils/billing.js)
    payments: 'Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irland',
    // sign in with Google, the Android app's pushes (Firebase Cloud Messaging) and Google Analytics
    // for Firebase (privacy § 3), Google Play
    google: 'Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland',
    // optional AI estimates for study goals (backend utils/studyEstimate.js, Claude API).
    // Entity + address: Anthropic's privacy policy § 9 (https://www.anthropic.com/legal/privacy, read 2026-11-06):
    // Anthropic Ireland, Limited is the controller/contracting entity for the EEA. Confirm that it is the
    // entity named in the API terms / DPA you accepted before going live.
    aiProvider: 'Anthropic Ireland, Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04 TR29, Irland',
};

// Date of the current version of the legal texts
// Switching Quidey Pro on (features/pro/flag.js) adds its parts to the texts: give that day's date then
export const LEGAL_VERSION_DATE = '06.11.2026 (Lernziele mit optionalen KI-Schätzungen über Anthropic, Benachrichtigungsart „Lernen“)';

export const COPYRIGHT_YEAR = 2026;

export const isPlaceholder = (value) => typeof value === 'string' && value.startsWith('TODO');

const missing = [...Object.entries(OWNER), ...Object.entries(PROCESSORS)].filter(([, v]) => isPlaceholder(v));
if (missing.length && import.meta.env.MODE !== 'test') {
    console.warn(`Impressum/Datenschutz: noch nicht ausgefüllt in src/legal/owner.js: ${missing.map(([k]) => k).join(', ')}`);
}
