// What is typed into a task or event form (TaskForm: new, TaskEditor: edit): the kind, the name
// (which picks an event's type by its keywords until one is picked by hand), day, time, length,
// end, priority, colour and the "More options" fields; and what the entry is saved as.
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { dateKey, minutesOfDay, timeText } from '../calendar/calendar';
import { endDayOffset, endOf, fromEnd } from './eventTimes';
import { matchEventType } from './kinds';

export const EMPTY_EXTRAS = { reminders: [], reminder_email: false, location: '', link: '', details: '', repeat: null, repeat_left: null };

// initial: { kind, name, due, time, duration, prio, description, color, eventTypeId, extras }
// (an event that has a type counts as having it picked by hand).
// pickTypes: false where there are no event types (a shared session's entry): no match, no
// following of the name.
export function useTaskDraft(initial = {}, { pickTypes = true } = {}) {
    const types = useSelector(state => state.task.eventTypes);
    const [kind, setKind] = useState(initial.kind ?? 'task');
    const [name, setName] = useState(initial.name ?? '');
    const [eventTypeId, setEventTypeId] = useState(initial.eventTypeId ?? null);
    // the type follows the name's keywords until one is picked by hand (also "none")
    const [typeByHand, setTypeByHand] = useState(Boolean(initial.eventTypeId));
    const [due, setDue] = useState(initial.due ?? '');
    const [time, setTime] = useState(initial.time ?? '');
    // a task's planned time, an event's length (minutes)
    const [duration, setDuration] = useState(initial.duration ?? null);
    const [prio, setPrio] = useState(initial.prio ?? null);
    const [description, setDescription] = useState(initial.description ?? '');
    const [color, setColor] = useState(initial.color ?? null);
    const [extras, setExtras] = useState(initial.extras ?? EMPTY_EXTRAS);

    const match = pickTypes ? matchEventType(name, types) : null;
    const followName = (nextName, nextKind) => {
        if (!pickTypes || typeByHand || nextKind !== 'event') return;
        setEventTypeId(matchEventType(nextName, types)?.type.id ?? null);
    };
    // a time of day needs a day: picking one first takes today
    const dayForTime = () => { if (!due) setDue(dateKey(new Date())); };
    // an event's end: worked out from start and length, setting it changes the length
    const setEnd = (value) => {
        const next = fromEnd(value, time, duration);
        if (next.time !== time) { dayForTime(); setTime(next.time); }
        setDuration(next.duration);
    };

    return {
        kind, name, due, time, duration, prio, description, color, extras, eventTypeId, typeByHand, match,
        setDue, setDuration, setPrio, setDescription, setColor, setName, setKind,
        changeKind: (next) => { setKind(next); followName(name, next); },
        // typed or spoken: the type follows the name (for the kind as it is: the form may read a
        // task as an event from the name, which doesn't count)
        changeName: (next) => { setName(next); followName(next, kind); },
        pickType: (id) => { setEventTypeId(id); setTypeByHand(true); },
        // a task whose name fits a type: one tap makes it such an event
        suggestEvent: () => { setKind('event'); setEventTypeId(match.type.id); },
        autoNote: !typeByHand && match && eventTypeId === match.type.id ? match.keyword : null,
        changeTime: (value) => { dayForTime(); setTime(value); },
        setTime,
        dayForTime,
        endTime: endOf(time, duration),
        endDays: endDayOffset(time, duration),
        setEnd,
        // minutes of day of the end for the hint "until 16:00" (null without start or length)
        untilTime: duration && minutesOfDay(time) !== null ? timeText(minutesOfDay(time) + duration) : null,
        changeExtras: (change) => setExtras(prev => ({ ...prev, ...change })),
        // what buildTaskPayload takes (reminders apart so the form can lay what the name said over it)
        values: { name, kind, due, time, prio, duration, color, eventTypeId, description, reminders: extras.reminders, extras },
    };
}

// What is saved of the typed fields: the same rules everywhere. A time of day, reminders and
// repeating need a day; an event has no priority; an end only for something that repeats.
// personal: false for an entry of a shared session or a family (no event type, reminders only
// with remindsAll, nothing to repeat); owner: false for somebody else's shared task (the server
// ignores kind, type and mail from others). withKind: the entry can be a task or an event.
// groupId: a session's / family's sub-group (null: none; undefined: not offered).
export function buildTaskPayload(fields, { personal = true, owner = true, withKind = true, groupId, remindsAll = false } = {}) {
    const { name, kind, due, time, prio, description, duration, color, eventTypeId, reminders, extras } = fields;
    const event = kind === 'event';
    const base = {
        name: name.trim(),
        due: due || null,
        due_time: due && time ? time : null,
        prio: event ? null : prio,
        description: description.trim(),
        duration_minutes: duration,
        color,
        location: extras.location.trim(),
        link: extras.link.trim(),
        details: extras.details.trim(),
    };
    if (!personal) {
        return {
            ...(withKind ? { kind } : {}),
            ...base,
            ...(groupId !== undefined ? { group_id: groupId } : {}),
            ...(remindsAll ? { reminders: due ? reminders : [] } : {}),
        };
    }
    return {
        ...base,
        // reminders count from the start, or from my all-day time on the day
        reminders: due ? reminders : [],
        ...(owner ? {
            // only a reminder can come by mail
            reminder_email: Boolean(due && reminders.length > 0 && extras.reminder_email),
            kind,
            event_type_id: event ? eventTypeId : null,
        } : {}),
        repeat: due ? extras.repeat ?? null : null,
        repeat_left: due && extras.repeat ? extras.repeat_left : null,
    };
}
