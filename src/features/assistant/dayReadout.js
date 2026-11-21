// Today's schedule as a few spoken sentences (Home's "Vorlesen", Quidey Max): the events and the
// tasks due today that are not done, timed ones first by their time, then those without a time.
//   "Heute: Mathe-Test um 9:00 Uhr, dann Training um 17:00 Uhr, außerdem: Hausaufgaben."
// At most READOUT_MAX are named, the rest is counted ("und 3 weitere"). Pure: `now` and the
// translator `t` come in. Texts: readout* in i18n/assistantTexts.js. (`language` is only here so
// the call reads like the others; the wording is all in the texts.)

import { fill, parseDate, sameDay } from '../helperFunction';

const READOUT_MAX = 8;

// "09:05:00" -> "9:05"
const clock = (time) => `${Number(time.slice(0, 2))}:${time.slice(3, 5)}`;

export function buildDayReadout(tasks, now, t) {
    const today = (tasks ?? []).filter(task => {
        if (task.done || !task.due) return false;
        const due = parseDate(task.due);
        return Boolean(due) && sameDay(due, now);
    });
    if (today.length === 0) return t('readoutNothing');

    const timed = today.filter(task => task.due_time).sort((a, b) => a.due_time.slice(0, 5).localeCompare(b.due_time.slice(0, 5)));
    const untimed = today.filter(task => !task.due_time);
    const named = [...timed, ...untimed].slice(0, READOUT_MAX);
    const more = today.length - named.length;

    const namedTimed = named.filter(task => task.due_time);
    const namedUntimed = named.filter(task => !task.due_time);
    let items = namedTimed.map(task => fill(t('readoutAt'), { name: task.name, time: clock(task.due_time) })).join(t('readoutThen'));
    if (namedUntimed.length > 0) {
        const rest = namedUntimed.map(task => task.name).join(', ');
        items += items ? `${t('readoutAlso')}${rest}` : rest;
    }
    if (more > 0) items += fill(t('readoutMore'), { n: more });
    return fill(t('readoutToday'), { items });
}
