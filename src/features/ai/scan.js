// Scanning study material with the AI (branch pro-features; one scan a day for now, backend ai.js):
// a PDF, photos, one of my notes or pasted text → a study plan, notes, tasks/events. Nothing is made
// until the person keeps it in the preview (ScanSheet.jsx).

import { apiFetch } from '../helperFunction';
import { shrinkImage } from '../focus/notebook';
import { refreshAiQuota } from './ai';

export const SCAN_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const SCAN_IMAGES_MAX = 5;

const readBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
});

// picked files → a source for the scan, or throws Error with code SCAN_PDF_TOO_BIG | SCAN_TOO_MANY |
// SCAN_FILE_TYPE (one PDF, or up to five pictures, shrunk here first)
export async function filesToSource(files) {
    const list = [...files];
    const pdfs = list.filter(file => file.type === 'application/pdf');
    const images = list.filter(file => file.type.startsWith('image/'));
    const fail = (code) => Object.assign(new Error(code), { code });
    if (pdfs.length + images.length !== list.length || list.length === 0) throw fail('SCAN_FILE_TYPE');
    if (pdfs.length > 0) {
        if (list.length > 1) throw fail('SCAN_TOO_MANY');
        if (pdfs[0].size > SCAN_PDF_MAX_BYTES) throw fail('SCAN_PDF_TOO_BIG');
        return { kind: 'pdf', data: await readBase64(pdfs[0]), name: pdfs[0].name };
    }
    if (images.length > SCAN_IMAGES_MAX) throw fail('SCAN_TOO_MANY');
    const shrunk = [];
    for (const image of images) {
        const data = await shrinkImage(image);
        if (!data) throw fail('SCAN_FILE_TYPE');
        shrunk.push({ data: data.replace(/^data:[^,]*,/, '') });
    }
    return { kind: 'images', images: shrunk };
}

// → { plan, notes, entries } (only what was asked for); the quota here is read again afterwards
export async function scanMaterial({ wants, source }) {
    try {
        const answer = await apiFetch('/api/ai/scan', { method: 'POST', body: JSON.stringify({ wants, source }) });
        return answer.result;
    } finally {
        // a fresh count of what is left (also after a refusal)
        refreshAiQuota();
    }
}
