// The notes area (/notes, testers first): the notebook's notes (features/focus/notebook.js,
// API /api/notebook) with folders, tags, colours, an archive and a trash. Folders and emptying
// the trash are under /api/tester/...; the server lets only testers set a note's folderId,
// tags, color, archived or trashed. A note in the trash is deleted for good after TRASH_DAYS.

import { apiFetch } from '../helperFunction';
import { translate } from '../../i18n/useTranslation';

export const TRASH_DAYS = 30;
export const TAGS_MAX = 10;
export const TAG_MAX = 30;
export const FOLDER_NAME_MAX = 40;
export const FOLDER_EMOJIS = ['📁', '📐', '🧪', '📖', '🧠', '💡', '🗂️', '✏️', '🌍', '💻', '🎨', '🎵', '⚖️', '🩺', '📈', '🗣️'];

// ---------- the server ----------
export const fetchTrash = () => apiFetch('/api/notebook?trash=1');
export const emptyTrash = () => apiFetch('/api/tester/notebook/trash', { method: 'DELETE' });
export const fetchFolders = () => apiFetch('/api/tester/note-folders');
export const createFolder = (folder) => apiFetch('/api/tester/note-folders', { method: 'POST', body: JSON.stringify(folder) });
export const updateFolder = (id, change) => apiFetch(`/api/tester/note-folders/${id}`, { method: 'PUT', body: JSON.stringify(change) });
export const removeFolder = (id) => apiFetch(`/api/tester/note-folders/${id}`, { method: 'DELETE' });

// ---------- which notes a view shows ----------
// views: 'all' | 'pinned' | 'folder:<id>' | 'tag:<word>' | 'archive' | 'trash' (the trash comes
// from the server on its own, the others are the same list filtered)
export const parseView = (value) => {
    const [kind, ...rest] = String(value ?? 'all').split(':');
    const arg = rest.join(':');
    if (kind === 'folder' && Number(arg) > 0) return { kind, folderId: Number(arg) };
    if (kind === 'tag' && arg) return { kind, tag: arg };
    if (['pinned', 'archive', 'trash'].includes(kind)) return { kind };
    return { kind: 'all' };
};

const sameTag = (a, b) => a.toLowerCase() === b.toLowerCase();

// the words of a search: every one must be in the title, the text or a tag ("#word" only a tag)
export function matchesQuery(note, query) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const text = `${note.title}\n${note.body}`.toLowerCase();
    const tags = (note.tags ?? []).map(tag => tag.toLowerCase());
    return words.every(word => word.startsWith('#') && word.length > 1
        ? tags.some(tag => tag.startsWith(word.slice(1)))
        : text.includes(word) || tags.some(tag => tag.includes(word)));
}

export function notesInView(notes, view, query = '') {
    const { kind, folderId, tag } = typeof view === 'string' ? parseView(view) : view;
    return notes.filter(note => {
        if (kind === 'trash') return true;
        if (kind === 'archive') { if (!note.archived) return false; }
        else if (note.archived) return false;
        if (kind === 'pinned' && !note.pinned) return false;
        if (kind === 'folder' && note.folderId !== folderId) return false;
        if (kind === 'tag' && !(note.tags ?? []).some(own => sameTag(own, tag))) return false;
        return true;
    }).filter(note => matchesQuery(note, query));
}

export const SORTS = ['updated', 'created', 'title'];
// pinned ones first (not in the trash), then by the chosen order
export function sortNotes(notes, sort = 'updated', pinnedFirst = true) {
    const by = {
        updated: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
        created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        title: (a, b) => (a.title || firstLine(a.body)).localeCompare(b.title || firstLine(b.body), undefined, { sensitivity: 'base' }),
    }[sort] ?? (() => 0);
    return [...notes].sort((a, b) => (pinnedFirst ? Number(b.pinned) - Number(a.pinned) : 0) || by(a, b));
}

// all tags in use (outside the archive), with how many notes carry them, most used first
export function tagCounts(notes) {
    const counts = new Map();
    for (const note of notes) {
        if (note.archived) continue;
        for (const tag of note.tags ?? []) {
            const key = [...counts.keys()].find(seen => sameTag(seen, tag)) ?? tag;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    return [...counts].map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// a tag as typed ("#Klausur ", "klausur,") → "Klausur", or null when it isn't one
export function cleanTag(value) {
    const tag = String(value ?? '').trim().replace(/^#+/, '').replace(/[\s,]+/g, '');
    return tag && tag.length <= TAG_MAX ? tag : null;
}

// ---------- the text ----------
export const firstLine = (body) => (body ?? '').split('\n')
    .map(line => line.replace(/^\s*(- \[( |x|X)\] |#{1,2} |[-*] |\d{1,3}\. |> )/, '').replace(/^-{3,}$/, '').trim())
    .find(Boolean) ?? '';

export function wordCount(body) {
    const words = (body ?? '').replace(/- \[( |x|X)\] /g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
    return words ? words.length : 0;
}
// about 200 words a minute, at least one once there is something to read
export const readingMinutes = (words) => (words === 0 ? 0 : Math.max(1, Math.round(words / 200)));

// Enter at the end of a list line goes on with the list: "- [ ] " (unticked), "- ", "* ",
// "1. " (counted up), "> ". On a line that is only the mark the list ends (the mark goes).
// → { body, cursor } or null when Enter should do what it always does.
const LIST_MARK = /^(\s*)(- \[(?: |x|X)\] |[-*] |(\d{1,3})\. |> )/;
export function continueList(body, cursor) {
    const start = body.lastIndexOf('\n', cursor - 1) + 1;
    const endAt = body.indexOf('\n', cursor);
    const end = endAt === -1 ? body.length : endAt;
    const line = body.slice(start, end);
    const match = line.match(LIST_MARK);
    if (!match || cursor < start + match[0].length) return null;
    if (line.slice(match[0].length).trim() === '' && cursor === end) {
        return { body: body.slice(0, start) + body.slice(end), cursor: start };
    }
    const [, indent, mark, number] = match;
    const next = indent + (number ? `${Number(number) + 1}. ` : mark.startsWith('- [') ? '- [ ] ' : mark);
    const insert = `\n${next}`;
    return { body: body.slice(0, cursor) + insert + body.slice(cursor), cursor: cursor + insert.length };
}

// **bold** / `code` around the selection (or the mark alone, with the cursor between)
// → { body, start, end } (the selection afterwards)
export function wrapSelection(body, start, end, mark) {
    const inner = body.slice(start, end);
    if (inner.startsWith(mark) && inner.endsWith(mark) && inner.length >= mark.length * 2) {
        const plain = inner.slice(mark.length, inner.length - mark.length);
        return { body: body.slice(0, start) + plain + body.slice(end), start, end: start + plain.length };
    }
    return {
        body: body.slice(0, start) + mark + inner + mark + body.slice(end),
        start: start + mark.length,
        end: end + mark.length,
    };
}

// ---------- templates for new notes ----------
// texts in notesTexts (noteTpl_<key>_title, noteTpl_<key>_body); {date} is today
export const NOTE_TEMPLATES = ['lecture', 'summary', 'exam', 'group', 'week'];

export function templateNote(key, language, date = new Date()) {
    const day = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const fillDate = (text) => String(text).replaceAll('{date}', day);
    return {
        title: fillDate(translate(language, `noteTpl_${key}_title`)),
        body: fillDate(translate(language, `noteTpl_${key}_body`)),
    };
}

// ---------- a copy, and the note as a file ----------
export const duplicateOf = (note, copyWord) => ({
    title: `${note.title || firstLine(note.body) || ''} (${copyWord})`.trim().slice(0, 120),
    body: note.body,
    folderId: note.folderId ?? null,
    tags: note.tags ?? [],
    color: note.color ?? null,
    // pictures come with the full note only: what isn't loaded isn't copied
    attachments: (note.attachments ?? []).filter(item => item.kind === 'link' || item.data),
});

export function noteMarkdown(note) {
    const parts = [];
    if (note.title) parts.push(`# ${note.title}`);
    if (note.tags?.length) parts.push(note.tags.map(tag => `#${tag}`).join(' '));
    if (note.body) parts.push(note.body);
    const links = (note.attachments ?? []).filter(item => item.kind === 'link');
    if (links.length) parts.push(links.map(item => `- [${item.title || item.url}](${item.url})`).join('\n'));
    return `${parts.join('\n\n')}\n`;
}

// "Formeln Analysis!" → "formeln-analysis.md"
export const noteFileName = (note) => `${(note.title || firstLine(note.body) || 'notiz')
    .toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'notiz'}.md`;

export function downloadNote(note) {
    const blob = new Blob([noteMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = noteFileName(note);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// days until a note in the trash goes for good
export const daysLeftInTrash = (note, now = Date.now()) => note.trashedAt
    ? Math.max(0, TRASH_DAYS - Math.floor((now - new Date(note.trashedAt).getTime()) / 86400000))
    : TRASH_DAYS;
