// Draws the Google Play feature graphic store/feature-graphic.png (1024 × 500, no transparency):
// the landing page's hero in short — dark above, the accent below, the logo and the line.
//   node scripts/store-graphic.mjs
// Needs Chrome or Edge (CHROME=<path> to pick one).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const font = pathToFileURL(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).href;
const browser = [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
].find((path) => path && existsSync(path));
if (!browser) throw new Error('No Chrome or Edge found; set CHROME=<path>');

// the logo (public/quidey-logo.svg)
const logo = (size, colour) => `
<svg width="${size}" height="${size}" viewBox="9 5 50 50">
    <defs><mask id="cut${size}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect width="64" height="64" fill="#fff" /><path d="M27 32l9 12" stroke="#000" stroke-width="10.5" stroke-linecap="round" />
    </mask></defs>
    <circle cx="25" cy="27" r="12" fill="none" stroke="${colour}" stroke-width="6" mask="url(#cut${size})" />
    <path d="M27 32l9 12L54 24" fill="none" stroke="${colour}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: url('${font}') format('woff2'); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1024px; height: 500px; overflow: hidden; }
body { font-family: Inter, sans-serif; background: #0e0d0c; color: #f4f3f1; position: relative; }
.lower { position: absolute; inset: 250px 0 0; background: #fb923c; }
.brand { position: absolute; left: 56px; top: 48px; display: flex; align-items: center; gap: 12px;
    font-size: 34px; font-weight: 750; letter-spacing: -0.03em; }
h1 { position: absolute; left: 56px; right: 56px; top: 132px; font-size: 104px; font-weight: 800;
    letter-spacing: -0.045em; line-height: 0.98; }
.bottom { display: block; color: #2a1305; margin-top: 0.12em; }
.sub { position: absolute; left: 56px; bottom: 44px; font-size: 28px; font-weight: 650;
    letter-spacing: -0.02em; color: #2a1305; }
</style></head>
<body>
    <div class="lower"></div>
    <div class="brand">${logo(44, '#fb923c')}Quidey</div>
    <h1>Eine Sache<span class="bottom">nach der anderen.</span></h1>
    <p class="sub">Lernplaner mit Fokus-Timer, Kalender und Lerngruppen</p>
</body></html>`;

const out = join(root, 'store');
mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'quidey-store-'));
try {
    const page = join(work, 'graphic.html');
    writeFileSync(page, html);
    execFileSync(browser, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1024,500',
        `--screenshot=${join(out, 'feature-graphic.png')}`, pathToFileURL(page).href,
    ], { stdio: 'ignore' });
    console.log(`store/feature-graphic.png`);
} finally {
    rmSync(work, { recursive: true, force: true });
}
