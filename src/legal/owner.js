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
};

// Date of the current version of the legal texts
export const LEGAL_VERSION_DATE = '21.10.2026 (gemeinsame Kalender, Quidey Family)';

export const COPYRIGHT_YEAR = 2026;

export const isPlaceholder = (value) => typeof value === 'string' && value.startsWith('TODO');

const missing = [...Object.entries(OWNER), ...Object.entries(PROCESSORS)].filter(([, v]) => isPlaceholder(v));
if (missing.length && import.meta.env.MODE !== 'test') {
    console.warn(`Impressum/Datenschutz: noch nicht ausgefüllt in src/legal/owner.js: ${missing.map(([k]) => k).join(', ')}`);
}
