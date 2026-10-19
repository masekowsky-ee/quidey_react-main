// HTTP security headers for the built site, written to dist/_headers (Cloudflare reads that file
// and sends the headers with every page). The API's address comes from VITE_API_URL, so the
// Content-Security-Policy lets the app talk to exactly that server and nothing else.

export function contentSecurityPolicy(apiUrl) {
    let apiOrigin = '';
    if (apiUrl) {
        // an invalid address must not end up in the policy (it would block nothing or everything)
        apiOrigin = new URL(apiUrl).origin;
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
    };
    return '/*\n' + Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`).join('\n') + '\n';
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
