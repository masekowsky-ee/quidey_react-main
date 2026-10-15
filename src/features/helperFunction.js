export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Request failed");
    }

    return response.json();
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
