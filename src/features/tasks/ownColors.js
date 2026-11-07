// Colours of one's own ("#rrggbb" from the colour wheel) in data-task-color. The eight named
// colours have their --task-color in index.css; an own colour gets a rule the first time it shows
// up anywhere on the page: [data-task-color="#2a9d8f"] { --task-color: #2a9d8f }. The rules live
// in one constructed stylesheet (CSSOM, so the strict CSP stays as it is: no style attributes, no
// <style> element). A watcher on the document finds them, so no component has to remember.
import { isOwnColor } from './taskColors';

let sheet = null;
const known = new Set();

function add(color) {
    if (!sheet || known.has(color) || !isOwnColor(color)) return;
    known.add(color);
    sheet.insertRule(`[data-task-color="${color}"]{--task-color:${color}}`, sheet.cssRules.length);
}

function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute('data-task-color')) add(root.getAttribute('data-task-color'));
    root.querySelectorAll?.('[data-task-color^="#"]').forEach(el => add(el.getAttribute('data-task-color')));
}

// once, before the app renders (main.jsx); a browser without constructed stylesheets keeps the
// named colours and shows own colours without their tone
export function startOwnColors() {
    if (sheet || typeof document === 'undefined' || typeof CSSStyleSheet === 'undefined'
        || !('adoptedStyleSheets' in document) || typeof MutationObserver === 'undefined') return;
    try {
        sheet = new CSSStyleSheet();
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch {
        sheet = null;
        return;
    }
    new MutationObserver((records) => {
        for (const record of records) {
            if (record.type === 'attributes') add(record.target.getAttribute('data-task-color'));
            else record.addedNodes.forEach(scan);
        }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-task-color'] });
    scan(document.documentElement);
}
