// An event's start, end and length, kept in step: only the start ("HH:MM") and the length
// (minutes) are stored (due_time, duration_minutes); the end is worked out from them. Changing
// the start or the length moves the end, setting the end changes the length. An end at or before
// the start means the next day (a party until 02:00).
import { minutesOfDay, timeText } from '../calendar/calendar';

// a length to start from when the end is set before anything else
export const DEFAULT_EVENT_MINUTES = 60;

// "16:00" for a start of "14:00" and 120 minutes; '' while one of them is missing
export function endOf(start, duration) {
    const from = minutesOfDay(start);
    return from === null || !duration ? '' : timeText(from + duration);
}

// how many days after the start's day the end is (0: the same day)
export function endDayOffset(start, duration) {
    const from = minutesOfDay(start);
    return from === null || !duration ? 0 : Math.floor((from + duration) / 1440);
}

// The end was set: { time, duration } to take over. Without a start, the start goes back from
// the end by the length there is (or an hour). An empty end clears the length.
export function fromEnd(end, start, duration) {
    const to = minutesOfDay(end);
    if (to === null) return { time: start, duration: null };
    const from = minutesOfDay(start);
    if (from === null) {
        const length = duration || DEFAULT_EVENT_MINUTES;
        return { time: timeText(to - length), duration: length };
    }
    // the end stays on the day it was on (a trip over several days), only its time changes;
    // an end at or before the start on that day is a day later
    let length = endDayOffset(start, duration) * 1440 + to - from;
    if (length <= 0) length += 1440;
    return { time: start, duration: length };
}
