// HTTP security headers for the built site, written to dist/_headers (Cloudflare reads that file
// and sends the headers with every page). The API's address comes from VITE_API_URL, so the
// Content-Security-Policy lets the app talk to exactly that server and nothing else.

export function contentSecurityPolicy(apiUrl) {
    let apiOrigin = '';
    if (apiUrl) {
        // an invalid address must not end up in the policy (it would block nothing or everything)
        const url = new URL(apiUrl);
        // the live connection (Socket.IO) upgrades to a WebSocket on the same host, which
        // connect-src only allows when its ws(s): address is listed too
        const socketOrigin = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
        apiOrigin = `${url.origin} ${socketOrigin}`;
    }
    return [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
    ].join('; ');
}

export function headersFile(apiUrl) {
    const headers = {
        'Content-Security-Policy': contentSecurityPolicy(apiUrl),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Cross-Origin-Opener-Policy': 'same-origin',
        // the app stays out of search results (quidey.com is the page to find); the SPA fallback
        // answers every address with index.html, so the header covers what the meta tag can't
        'X-Robots-Tag': 'noindex',
    };
    const block = (path, entries) => `${path}\n` + Object.entries(entries).map(([name, value]) => `  ${name}: ${value}`).join('\n') + '\n';
    // Built files carry a hash of their content in the name, so a changed file gets a new name:
    // browsers can keep them for a year without asking again. index.html (no hash) is left to
    // the default, so a deploy is seen right away. The service worker (pwa.js) is always asked
    // for again, so an update of the installed app isn't held back by a cached copy.
    return block('/*', headers)
        + block('/assets/*', { 'Cache-Control': 'public, max-age=31536000, immutable' })
        + block('/sw.js', { 'Cache-Control': 'no-cache' });
}

// Vite plugin: adds _headers to the build output
export function securityHeaders(apiUrl) {
    return {
        name: 'quidey-security-headers',
        apply: 'build',
        generateBundle() {
            this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile(apiUrl) });
        },
    };
}
