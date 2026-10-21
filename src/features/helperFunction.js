// Full URL for an API path. VITE_API_URL is the backend's address in production builds
// (e.g. https://api.quidey.example.com); locally it's empty and Vite's proxy forwards /api.
export function apiUrl(path) {
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    return base + path;
}

// Fired when the server says the app is only for pro users and testers (closed beta),
// or that something is only for testers
export const PRO_REQUIRED_EVENT = 'quidey:pro-required';
const ACCESS_CODES = ['PRO_REQUIRED', 'TESTER_REQUIRED'];

// Fired when the server no longer accepts my login (expired, password changed elsewhere,
// "sign out everywhere"): App signs out
export const SIGNED_OUT_EVENT = 'quidey:signed-out';
const SIGNED_OUT_CODES = ['TOKEN_REVOKED', 'TOKEN_INVALID'];

export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    const response = await fetch(apiUrl(url), {
        ...options,
        headers: {
            ...options.headers,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || "Request failed");
        // status and the API's error code let the UI show a translated message
        error.status = response.status;
        error.code = errorData.code;
        // pro / tester was taken away while the app is open: App checks access again
        // (and shows the beta screen, or hides what only testers see)
        if (ACCESS_CODES.includes(errorData.code)) window.dispatchEvent(new Event(PRO_REQUIRED_EVENT));
        if (token && SIGNED_OUT_CODES.includes(errorData.code)) window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
        throw error;
    }

    return response.json();
}

// "Jane Doe" -> "JD", "jane" -> "J", "__ben" -> "B", for avatar circles.
// Uses the first letter or digit of each word, so symbols like "_" or "@" are skipped.
export function getInitials(name) {
    const initials = (name ?? '').trim().split(/\s+/)
        .map(part => part.match(/[\p{L}\p{N}]/u)?.[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return initials || '?';
}

// "vor 3 Minuten" / "3 minutes ago"; "jetzt" / "now" for the last minute
export function formatRelative(value, now, locale) {
    const seconds = Math.round((new Date(value).getTime() - now) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const abs = Math.abs(seconds);
    if (abs < 60) return rtf.format(0, 'second');
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
    return rtf.format(Math.round(seconds / 86400), 'day');
}

// Fills {placeholders} in a translated text: fill('{user} joined', { user: 'Ann' }) -> 'Ann joined'
export function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

// Rows as CSV text (comma separated, quoted where needed), e.g. for a download.
// Text starting with = + - @ (or a tab/return) would run as a formula in Excel, so it gets a
// leading ' and is shown as plain text: a task called "=HYPERLINK(...)" stays harmless.
export function toCsv(rows) {
    const cell = (value) => {
        let text = String(value ?? '');
        if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return rows.map(row => row.map(cell).join(',')).join('\r\n');
}

// Offers text as a file download
export function downloadFile(filename, text, type = 'text/csv') {
    // the BOM makes Excel read umlauts correctly; other formats (e.g. .ics) must not start with one
    const parts = type === 'text/csv' ? ['﻿', text] : [text];
    const blob = new Blob(parts, { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Name to show for a user from the api ({ username, displayName })
export function displayName(user) {
    return user?.displayName || user?.username || '?';
}

// Same calendar day, time of day dropped (local time)
export function toDateOnly(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function sameDay(a, b) {
    return toDateOnly(a).getTime() === toDateOnly(b).getTime();
}

// Monday = 0 ... Sunday = 6, matching the weekDays translations
export function mondayIndex(date) {
    return (date.getDay() + 6) % 7;
}

// The 42 days (6 weeks) shown for a month, starting on the Monday on/before the 1st,
// so the calendar grid never jumps in height
export function monthGrid(viewMonth) {
    const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1 - mondayIndex(viewMonth));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

// 3723000 ms -> "01:02:03"
export function formatClock(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// Worked time for summaries: 45000 -> "45 s", 3900000 -> "1 h 5 min"
export function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
    if (totalSeconds < 60) return `${totalSeconds} s`;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// A day from the api or a form as a local Date (null when empty or invalid).
// The api sends date columns as local midnight in UTC (e.g. 2026-10-19T22:00:00.000Z
// for Oct 20), so they are read with local getters to get the day that was saved.
// A plain "2026-10-20" would be read as UTC midnight by new Date(), which is the day
// before west of Greenwich, so it is built from its parts instead.
export function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
    const plain = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
    const date = parseDate(value);
    if (!date) return '';
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

// Same date as YYYY-MM-DD, the format <input type="date"> expects. Also what the api is
// sent: the time of day in an ISO timestamp would be dropped and could shift the day.
export function toInputDate(value) {
    const date = parseDate(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Open task whose day is before today
export function isOverdue(task, today = new Date()) {
    const due = parseDate(task?.due);
    return Boolean(due && !task.done && toDateOnly(due) < toDateOnly(today));
}
