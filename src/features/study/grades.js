// Grades of finished work in Lernen (see the backend's utils/grades.js): the account's scale is points
// 0-15 or marks 1-6 (1 best); the server stores points and answers in the account's scale.

export const GRADE_RANGE = { points: [0, 15], marks: [1, 6] };

// A typed grade ("12", "2,3", "2.3") as a number in the scale, null when it isn't one in range
export function parseGrade(text, scale) {
    const clean = String(text ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
    const value = Number(clean);
    const [min, max] = GRADE_RANGE[scale] ?? GRADE_RANGE.points;
    return value >= min && value <= max ? value : null;
}

// 2.3 -> '2,3' (de) / '2.3' (en); no grade -> an en dash
export function formatGrade(value, language = 'de') {
    if (value == null) return '–';
    const text = String(Math.round(value * 100) / 100);
    return language === 'de' ? text.replace('.', ',') : text;
}
