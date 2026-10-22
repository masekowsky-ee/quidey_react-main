// The period the statistics show: a week, a month, a year or everything, stepped back with an
// offset (0 = this one, -1 = the one before, ...). Days are local; keys as the api uses them.
import { addDays, addMonths, dateKey, startOfMonth, startOfWeek } from '../calendar/calendar';
import { parseDate, toDateOnly } from '../helperFunction';

export const RANGES = ['week', 'month', 'year', 'all'];

const monthKey = (date) => dateKey(date).slice(0, 7);
const yearKey = (date) => dateKey(date).slice(0, 4);

// more months than this and "everything" goes by year
const MAX_MONTH_BARS = 36;

// { range, offset, from, to (Dates or null for everything), unit: 'day' | 'month' | 'year',
//   buckets: [{ key, date }] } — the bars of the chart, oldest first
export function periodOf(range, offset = 0, today = new Date(), firstDay = null) {
    const day = toDateOnly(today);
    if (range === 'week') {
        const from = addDays(startOfWeek(day), 7 * offset);
        const to = addDays(from, 6);
        return { range, offset, from, to, unit: 'day', buckets: daysBetween(from, to) };
    }
    if (range === 'month') {
        const from = startOfMonth(addMonths(startOfMonth(day), offset));
        const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
        return { range, offset, from, to, unit: 'day', buckets: daysBetween(from, to) };
    }
    if (range === 'year') {
        const from = new Date(day.getFullYear() + offset, 0, 1);
        const to = new Date(day.getFullYear() + offset, 11, 31);
        return { range, offset, from, to, unit: 'month', buckets: monthsBetween(from, to) };
    }
    // everything: from the first day with anything up to today
    const first = parseDate(firstDay);
    const start = first && first <= day ? first : startOfMonth(day);
    const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth() + 1;
    if (months > MAX_MONTH_BARS) {
        const buckets = [];
        for (let y = start.getFullYear(); y <= day.getFullYear(); y++) buckets.push({ key: String(y), date: new Date(y, 0, 1) });
        return { range: 'all', offset: 0, from: null, to: null, unit: 'year', buckets };
    }
    return { range: 'all', offset: 0, from: null, to: null, unit: 'month', buckets: monthsBetween(startOfMonth(start), day) };
}

function daysBetween(from, to) {
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push({ key: dateKey(d), date: d });
    return days;
}

function monthsBetween(from, to) {
    const months = [];
    for (let d = startOfMonth(from); d <= to; d = addMonths(d, 1)) months.push({ key: monthKey(d), date: d });
    return months;
}

// The bucket a day ("2026-10-20") falls into
export const bucketKey = (unit, day) => (unit === 'day' ? day : unit === 'month' ? day.slice(0, 7) : day.slice(0, 4));

// Sums the api's [{ day, ms }] into the period's buckets: { [bucketKey]: ms }
export function sumByBucket(unit, days) {
    const sums = {};
    for (const { day, ms } of days ?? []) {
        const key = bucketKey(unit, day);
        sums[key] = (sums[key] ?? 0) + ms;
    }
    return sums;
}

// Whether a moment (Date or text) lies in the period (everything: always)
export function inPeriod(period, value) {
    if (!period.from) return true;
    const day = toDateOnly(new Date(value));
    return day >= period.from && day <= period.to;
}

// The api's query for the period: "?from=2026-10-19&to=2026-10-25", '' for everything
export const periodQuery = (period) => (period.from ? `?from=${dateKey(period.from)}&to=${dateKey(period.to)}` : '');

// 32 h, 32 h 30 min, 45 min: hours as such (a work week is "40 h", not "1 d 16 h")
export function hoursText(ms) {
    const minutes = Math.round((ms ?? 0) / 60000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export { monthKey, yearKey };
