// The notebook in the Fokusraum: my notes, on their own or about a task (API /api/notebook).
// A note is a title, text and attachments. In the text, lines starting with "- [ ]" / "- [x]" are
// a checklist (ticked right in the note), "# " a heading; links in it can be opened.
// Attachments: links { kind: 'link', url, title } and pictures { kind: 'image', data, name }
// (pasted or picked, made small here first: at most IMAGE_MAX_SIDE pixels and IMAGE_MAX_BYTES).

import { apiFetch } from '../helperFunction';

export const NOTE_IMAGES_MAX = 4;
export const NOTE_ATTACHMENTS_MAX = 10;
const IMAGE_MAX_SIDE = 1400;
const IMAGE_MAX_BYTES = 380 * 1024;

export const fetchNotes = () => apiFetch('/api/notebook');
export const fetchNote = (id) => apiFetch(`/api/notebook/${id}`);
export const createNote = (note) => apiFetch('/api/notebook', { method: 'POST', body: JSON.stringify(note) });
export const updateNote = (id, change) => apiFetch(`/api/notebook/${id}`, { method: 'PUT', body: JSON.stringify(change) });
export const removeNote = (id) => apiFetch(`/api/notebook/${id}`, { method: 'DELETE' });

// ---------- the text ----------
const CHECK_LINE = /^(\s*)- \[( |x|X)\] (.*)$/;

// the lines of a note as parts to show: { kind: 'check', done, text, index } | { kind: 'heading' } | { kind: 'text' }
export function noteLines(body) {
    return (body ?? '').split('\n').map((line, index) => {
        const check = line.match(CHECK_LINE);
        if (check) return { kind: 'check', done: check[2] !== ' ', text: check[3], index };
        if (line.startsWith('# ')) return { kind: 'heading', text: line.slice(2), index };
        return { kind: 'text', text: line, index };
    });
}

// ticks / unticks the checklist line at index
export function toggleCheck(body, index) {
    const lines = (body ?? '').split('\n');
    const check = lines[index]?.match(CHECK_LINE);
    if (!check) return body;
    lines[index] = `${check[1]}- [${check[2] === ' ' ? 'x' : ' '}] ${check[3]}`;
    return lines.join('\n');
}

export const checklistCount = (body) => {
    const checks = noteLines(body).filter(line => line.kind === 'check');
    return { done: checks.filter(line => line.done).length, total: checks.length };
};

// the text split into plain parts and links (shown as links, never as HTML)
const URL_IN_TEXT = /(https?:\/\/[^\s<>"')]+)/g;
export const linkParts = (text) => text.split(URL_IN_TEXT).map((part, i) => ({ link: i % 2 === 1, text: part }));

export const isWebUrl = (value) => /^https?:\/\/[^\s]+$/i.test(value.trim());

// ---------- pictures ----------
const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
});

// A picture file → a small data: URL (JPEG/WebP), or null when it can't be made small enough
export async function shrinkImage(file) {
    if (!file?.type?.startsWith('image/')) return null;
    const source = await loadImage(await readAsDataUrl(file));
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // transparent parts on white, JPEG has no alpha
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
        const webp = canvas.toDataURL('image/webp', quality);
        const data = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
        if (data.length <= IMAGE_MAX_BYTES) return data;
    }
    return null;
}
