// A pasted list of topics -> one name per non-empty line. A leading bullet (-, *, •) or number
// ("1." / "2)") is removed; at most 40 lines of at most 200 characters.
export const MAX_PARTS = 40;
export const PART_NAME_MAX = 200;

export function parseParts(text) {
    return String(text ?? '')
        .split(/\r?\n/)
        .map(line => line.trim().replace(/^(?:[-*•]+\s*|\d+[.)]\s+)/, '').trim())
        .filter(Boolean)
        .slice(0, MAX_PARTS)
        .map(line => line.slice(0, PART_NAME_MAX));
}

const RANGE = /(?:\bpp?\.|\bS\.|\bSeiten\b|\bpages?\b)\s*(\d+)\s*(?:[-–—]|\bbis\b|\bto\b)\s*(\d+)/i;

// "S. 120-160" -> 40 (the same rule as the server's estimate), else null
export function pageCount(name) {
    const m = RANGE.exec(String(name ?? ''));
    if (!m) return null;
    const n = Number(m[2]) - Number(m[1]);
    return n > 0 ? n : null;
}
