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

// ---------- quick entry 2.0: ranges, lengths, colours, types, reminders ----------
// "Erinnere mich …" / "remind me (to) …" at the start: a reminder, not a task
const REMINDER_PREFIX = /^\s*(?:erinnere\s+mich|remind\s+me)(?:\s+(?:to|an|daran))?[\s,:]*/iu;

const UNIT_MINUTES = (unit) => {
    const u = unit.toLowerCase();
    if (/^(?:w|wochen?|weeks?)$/.test(u)) return 7 * 24 * 60;
    if (/^(?:d|tage?n?|days?)$/.test(u)) return 24 * 60;
    if (/^(?:h|std|stunden?|hours?|hrs?)$/.test(u)) return 60;
    return 1;
};
const UNIT = '(min(?:uten?|utes?|s)?|m|h|std|stunden?|hours?|hrs?|tage?n?|days?|d|wochen?|weeks?)';
const REMINDER_WORD = '(?:reminder|erinnerung|erinnere(?:\\s+mich)?|remind(?:\\s+me)?)';
const BEFORE_WORD = '(?:vorher|davor|prior|before|in\\s+advance|früher|frueher)';
// "Erinnerung 15 min (vorher)", "reminder 1 day prior", and "30 min vorher" without the word
const REMINDER_RULES = [
    new RegExp(`${START}${REMINDER_WORD}\\s*:?\\s*(\\d{1,3})\\s*${UNIT}\\.?(?:\\s*${BEFORE_WORD})?${END}`, 'iu'),
    new RegExp(`${START}(\\d{1,3})\\s*${UNIT}\\.?\\s*${BEFORE_WORD}${END}`, 'iu'),
];
const REMINDER_MAX = 7 * 24 * 60;

// 13:00 - 15:00, 13–15 Uhr, von 13 bis 15 Uhr, 1pm-3pm. A bare "3-5" is not a time (pages,
// chapters): it needs a colon, "Uhr", am/pm or the "von … bis" form.
const RANGE_RULE = new RegExp(
    `${START}(von\\s+|from\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|uhr)?\\s*(?:-|–|—|bis|to|until|till)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|uhr)?${END}`, 'iu');

// 90 min, 2h, 1,5 Std., für 2 Stunden, for 45 minutes
const DURATION_RULE = new RegExp(`${START}(?:für\\s+|for\\s+|dauer\\s*:?\\s*)?(\\d{1,3}(?:[.,]\\d)?)\\s*(h|std|stunden?|hours?|hrs?|min(?:uten?|utes?|s)?)\\.?${END}`, 'iu');

// the eight colours, German and English
const COLOR_WORDS = {
    rot: 'red', red: 'red', orange: 'orange', gelb: 'yellow', yellow: 'yellow',
    grün: 'green', gruen: 'green', green: 'green', türkis: 'teal', tuerkis: 'teal', teal: 'teal',
    blau: 'blue', blue: 'blue', lila: 'violet', violett: 'violet', violet: 'violet', purple: 'violet',
    pink: 'pink', rosa: 'pink',
};
const COLOR_RULE = new RegExp(`${START}(?:(?:farbe|color|colour)\\s*:?\\s*)?(${Object.keys(COLOR_WORDS).join('|')})${END}`, 'iu');

// "type: school", "Typ: Schule" up to the next comma or the end
const TYPE_RULE = /(?<![\p{L}\p{N}])(?:type|typ|art)\s*:\s*([^,;!?\n]+?)\s*(?=[,;!?\n]|\.(?:\s|$)|$)/iu;

const toMinutes = (hour, minute) => hour * 60 + minute;
const asHour = (hour, suffix) => {
    const s = (suffix ?? '').toLowerCase();
    if (s === 'am' || s === 'pm') {
        if (hour < 1 || hour > 12) return null;
        return (hour % 12) + (s === 'pm' ? 12 : 0);
    }
    return hour;
};

function findType(name, eventTypes) {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return null;
    return eventTypes.find(type => type.name.toLowerCase() === wanted)
        ?? eventTypes.find(type => type.name.toLowerCase().startsWith(wanted) || wanted.startsWith(type.name.toLowerCase()))
        ?? null;
}

// spaces, and commas / dots left over where words were taken out
const tidy = (text) => text.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/([,;:])(?:\s*[,;:.])+/g, '$1')
    .replace(/^[\s,;:.–-]+/, '').replace(/[\s,;:–-]+$/, '').replace(/(\p{L})\.$/u, '$1').trim();

// parseQuickEntry(text, now, { eventTypes }) → { name, kind, due, time, end, durationMinutes, prio,
// color, eventTypeId, reminders, found }; kind 'event' with a time range or a type, 'reminder' for
// "Erinnere mich …", else 'task'. found: [{ kind, text }] with the words that were read.
export function parseQuickEntry(text, now = new Date(), { eventTypes = [] } = {}) {
    let rest = ` ${text ?? ''} `;
    const found = [];
    let due = null;
    let time = null;
    let end = null;
    let durationMinutes = null;
    let prio = null;
    let color = null;
    let eventTypeId = null;
    const reminders = [];
    let asReminder = false;
    const take = (kind, match) => { found.push({ kind, text: match.trim() }); rest = rest.replace(match, ' '); };

    const prefix = rest.match(REMINDER_PREFIX);
    if (prefix && prefix[0].trim()) {
        asReminder = true;
        found.push({ kind: 'asReminder', text: prefix[0].trim() });
        rest = ` ${rest.slice(prefix[0].length)}`;
    }

    // reminders before lengths: "15 min vorher" is a reminder, not a length
    for (const rule of REMINDER_RULES) {
        for (let m = rest.match(rule); m; m = rest.match(rule)) {
            const minutes = Number(m[1]) * UNIT_MINUTES(m[2]);
            take('reminder', m[0]);
            if (minutes <= REMINDER_MAX && !reminders.includes(minutes)) reminders.push(minutes);
        }
    }

    // the date first: "24.12." must not be read as the time 24.12
    for (const rule of DAY_RULES) {
        const m = rest.match(rule.re);
        if (!m) continue;
        const day = rule.day(now, m);
        if (!day) continue;
        due = toInputDate(day);
        take('due', m[0]);
        break;
    }

    const r = rest.match(RANGE_RULE);
    if (r) {
        const [, from, h1, m1, s1, h2, m2, s2] = r;
        const marked = Boolean(from || m1 || m2 || s1 || s2);
        const startHour = asHour(Number(h1), s1 ?? (s2 && /am|pm/i.test(s2) ? s2 : null));
        const endHour = asHour(Number(h2), s2);
        const startMin = Number(m1 ?? 0);
        const endMin = Number(m2 ?? 0);
        if (marked && startHour != null && endHour != null && startHour < 24 && endHour <= 24 && startMin < 60 && endMin < 60) {
            time = `${pad(startHour)}:${pad(startMin)}`;
            end = `${pad(endHour % 24)}:${pad(endMin)}`;
            durationMinutes = ((toMinutes(endHour, endMin) - toMinutes(startHour, startMin)) + 24 * 60) % (24 * 60) || null;
            take('time', r[0]);
        }
    }

    if (!time) {
        for (const rule of TIME_RULES) {
            const m = rest.match(rule.re);
            if (!m) continue;
            const parts = rule.time(m);
            if (!parts) continue;
            const [hour, minute] = parts;
            if (hour > 23 || minute > 59) continue;
            time = `${pad(hour)}:${pad(minute)}`;
            take('time', m[0]);
            break;
        }
    }

    if (durationMinutes == null) {
        const d = rest.match(DURATION_RULE);
        if (d) {
            const minutes = Math.round(Number(d[1].replace(',', '.')) * UNIT_MINUTES(d[2]));
            if (minutes > 0 && minutes <= 24 * 60) { durationMinutes = minutes; take('duration', d[0]); }
        }
    }

    const t = rest.match(TYPE_RULE);
    if (t) {
        const type = findType(t[1], eventTypes);
        if (type) { eventTypeId = type.id; take('type', t[0]); }
    }

    const c = rest.match(COLOR_RULE);
    if (c) { color = COLOR_WORDS[c[1].toLowerCase()]; take('color', c[0]); }

    const p = rest.match(PRIO_RULE);
    if (p) {
        prio = p[1] ? PRIOS[p[1].toLowerCase()] : PRIOS.hoch;
        take('prio', p[0]);
    }

    // a time of day needs a day: today
    if (time && !due) due = toInputDate(now);

    const name = tidy(rest);
    const kind = asReminder ? 'reminder' : (end || eventTypeId ? 'event' : 'task');
    // nothing but a day or a time is not a task: then the text stays the name
    if (!name) {
        return { name: tidy(text ?? ''), kind: 'task', due: null, time: null, end: null, durationMinutes: null, prio: null, color: null, eventTypeId: null, reminders: [], found: [] };
    }
    return { name, kind, due, time, end, durationMinutes, prio, color, eventTypeId, reminders: reminders.sort((a, b) => a - b), found };
}

// words about time the rules don't read ("nächste Woche", "nachmittags", "every Monday"): left in
// the name, they mean the line said more than was understood
const VAGUE_TIME = new RegExp(`${START}(?:woche|wochenende|nachmittags?|vormittags?|abends?|morgens|mittags?|früh|frueh|spät|spaet|nächste[nrs]?|naechste[nrs]?|übernächste[nrs]?|monat|später|spaeter|jede[nrs]?|uhr|erinnere?|week|weekend|afternoon|evening|morning|tonight|noon|month|later|every|remind|o'clock)${END}`, 'iu');

// A long line whose rest still talks about time: worth offering to the AI (one of the day's helps)
export function needsAiHelp(text, parsed) {
    const words = (text ?? '').trim().split(/\s+/).filter(Boolean).length;
    return words >= 6 && VAGUE_TIME.test(parsed.name);
}

// The name without the words of the kinds that were taken over (e.g. only the day, when a time
// was already picked by hand and the "14 Uhr" in the name stays as it was written)
export function stripFound(text, found, kinds) {
    let rest = ` ${text ?? ''} `;
    for (const part of found) if (kinds.includes(part.kind)) rest = rest.replace(part.text, ' ');
    return tidy(rest);
}
