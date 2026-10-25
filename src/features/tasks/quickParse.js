import { toInputDate } from '../helperFunction';

// Quick entry: a day, a time and a priority written into a new task's name ("Übungsblatt
// morgen 14 Uhr !hoch") are found here, so the form can take them over and keep only the name
// ("Übungsblatt"). German and English, whatever the app's language. Only whole words count, so
// "Morgenroutine" stays a name.
//
// parseQuickEntry(text, now) → { name, due, time, prio, found } where due is YYYY-MM-DD or null,
// time HH:MM or null, prio 0-100 or null, and found lists what was recognised.

const WEEKDAYS = [
    ['sonntag', 'sunday'],
    ['montag', 'monday'],
    ['dienstag', 'tuesday'],
    ['mittwoch', 'wednesday'],
    ['donnerstag', 'thursday'],
    ['freitag', 'friday'],
    ['samstag', 'saturday'],
];

// the same levels as prioLevel (calendar.js): high ≥ 67, medium ≥ 34
const PRIOS = { hoch: 80, high: 80, mittel: 50, medium: 50, niedrig: 20, low: 20 };

// a word boundary that knows umlauts (\b does not)
const START = '(?<![\\p{L}\\p{N}])';
const END = '(?![\\p{L}\\p{N}])';
const word = (source) => new RegExp(`${START}${source}${END}`, 'iu');

const addDays = (date, days) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
};

const pad = (n) => String(n).padStart(2, '0');

// every rule: a pattern and what it means; the first match of each kind wins
const DAY_RULES = [
    // "übermorgen" before "morgen", which is a part of it
    { re: word('(?:am\\s+|on\\s+)?(?:übermorgen|uebermorgen|day after tomorrow)'), day: (now) => addDays(now, 2) },
    { re: word('(?:heute|today)'), day: (now) => now },
    { re: word('(?:morgen|tomorrow)'), day: (now) => addDays(now, 1) },
    {
        re: word('in\\s+(\\d{1,2})\\s+(?:tagen|tag|days|day)'),
        day: (now, m) => addDays(now, Number(m[1])),
    },
    {
        // a weekday: the next one, today if it is today
        re: word(`(?:am\\s+|on\\s+|next\\s+|nächsten\\s+|naechsten\\s+)?(${WEEKDAYS.flat().join('|')})`),
        day: (now, m) => {
            const target = WEEKDAYS.findIndex(names => names.includes(m[1].toLowerCase()));
            return addDays(now, (target - now.getDay() + 7) % 7);
        },
    },
    {
        // a date: 24.12. or 24.12.2026 (a year in two digits counts too)
        re: word('(?:am\\s+|on\\s+)?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2}|\\d{4})?'),
        day: (now, m) => {
            const day = Number(m[1]);
            const month = Number(m[2]);
            let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getFullYear();
            const date = new Date(year, month - 1, day);
            if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
            // without a year a day that has passed means next year's
            if (!m[3] && date < addDays(now, 0)) {
                year += 1;
                return new Date(year, month - 1, day);
            }
            return date;
        },
    },
];

const TIME_RULES = [
    // 9am, 9:30pm: written together, since "9 am Bahnhof" is German for "9 at the station"
    {
        re: word('(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?(am|pm)'),
        time: (m) => {
            const hour = Number(m[1]);
            if (hour < 1 || hour > 12) return null;
            return [(hour % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0), Number(m[2] ?? 0)];
        },
    },
    // 14:30, 14.30 Uhr, um 9:05
    { re: word('(?:um\\s+|at\\s+)?(\\d{1,2})[:.](\\d{2})(?:\\s*uhr)?'), time: (m) => [Number(m[1]), Number(m[2])] },
    // 14 Uhr, um 9 Uhr
    { re: word('(?:um\\s+)?(\\d{1,2})\\s*uhr'), time: (m) => [Number(m[1]), 0] },
];

const PRIO_RULE = new RegExp(`(?<![\\p{L}\\p{N}!])!(${Object.keys(PRIOS).join('|')})?${END}`, 'iu');

const tidy = (text) => text.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();

export function parseQuickEntry(text, now = new Date()) {
    let rest = ` ${text ?? ''} `;
    const found = [];
    let due = null;
    let time = null;
    let prio = null;

    // the date first: "24.12." must not be read as the time 24.12
    for (const rule of DAY_RULES) {
        const m = rest.match(rule.re);
        if (!m) continue;
        const day = rule.day(now, m);
        if (!day) continue;
        due = toInputDate(day);
        found.push({ kind: 'due', text: m[0].trim() });
        rest = rest.replace(m[0], ' ');
        break;
    }

    for (const rule of TIME_RULES) {
        const m = rest.match(rule.re);
        if (!m) continue;
        const parts = rule.time(m);
        if (!parts) continue;
        const [hour, minute] = parts;
        if (hour > 23 || minute > 59) continue;
        time = `${pad(hour)}:${pad(minute)}`;
        found.push({ kind: 'time', text: m[0].trim() });
        rest = rest.replace(m[0], ' ');
        break;
    }

    const p = rest.match(PRIO_RULE);
    if (p) {
        prio = p[1] ? PRIOS[p[1].toLowerCase()] : PRIOS.hoch;
        found.push({ kind: 'prio', text: p[0].trim() });
        rest = rest.replace(p[0], ' ');
    }

    // a time of day needs a day: today
    if (time && !due) due = toInputDate(now);

    const name = tidy(rest);
    // nothing but a day or a time is not a task: then the text stays the name
    if (!name) return { name: tidy(text ?? ''), due: null, time: null, prio: null, found: [] };
    return { name, due, time, prio, found };
}

// The name without the words of the kinds that were taken over (e.g. only the day, when a time
// was already picked by hand and the "14 Uhr" in the name stays as it was written)
export function stripFound(text, found, kinds) {
    let rest = ` ${text ?? ''} `;
    for (const part of found) if (kinds.includes(part.kind)) rest = rest.replace(part.text, ' ');
    return tidy(rest);
}
