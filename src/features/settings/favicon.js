// The browser tab icon in the chosen accent color. public/quidey-logo.svg is the same drawing
// in the default Abendrot, used until the app has started.

// Each palette's swatch color (its dark-mode accent): tab bars don't follow the app's theme,
// so the icon keeps one color per accent
export const ACCENT_COLORS = {
    sunset: '#fb923c',
    green: '#0ed30e',
    ocean: '#38bdf8',
    violet: '#a78bfa',
    rose: '#fb7185',
    gold: '#facc15',
};

// The logo as an SVG file in one color (see components/Logo.jsx)
export function logoSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="9 5 50 50">`
        + `<defs><mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">`
        + `<rect width="64" height="64" fill="#fff"/>`
        + `<path d="M27 32l9 12" stroke="#000" stroke-width="10.5" stroke-linecap="round"/></mask></defs>`
        + `<circle cx="25" cy="27" r="12" fill="none" stroke="${color}" stroke-width="6" mask="url(#cut)"/>`
        + `<path d="M27 32l9 12L54 24" fill="none" stroke="${color}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`
        + `</svg>`;
}

// Points the page's icon at the logo in the accent's color
export function applyFavicon(accent) {
    const color = ACCENT_COLORS[accent] ?? ACCENT_COLORS.sunset;
    const link = document.querySelector('link[rel="icon"]');
    if (!link) return;
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml,${encodeURIComponent(logoSvg(color))}`;
}
