// Full URL for an API path. VITE_API_URL is the backend's address in production builds
// (e.g. https://api.quidey.example.com); locally it's empty and Vite's proxy forwards /api.
export function apiUrl(path) {
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    return base + path;
}

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

// The api sends date columns as local midnight in UTC (e.g. 2026-10-19T22:00:00.000Z
// for Oct 20), so read them with local getters to get the day that was saved.
export function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

// Same date as YYYY-MM-DD, the format <input type="date"> expects
export function toInputDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
