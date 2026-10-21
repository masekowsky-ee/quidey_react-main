import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../helperFunction';
import { normalizeSession } from '../together/togetherAction';
import { addFamilyTask, fetchFamily, removeFamilyTask, updateFamilyTask } from '../family/family';
import { useRealtimeRefresh } from '../realtime/socket';

// Which calendar the calendar page shows, from ?cal= in the address:
// none: my own tasks; "session-5": the tasks of shared session 5; "family-3": family 3's calendar.
// Shared calendars hold the same kind of tasks, minus the personal parts (reminders, repeating,
// groups, sharing). Every member can add, change, move and tick them off.

export function parseCalendarSource(value) {
    const match = typeof value === 'string' ? value.match(/^(session|family)-(\d{1,10})$/) : null;
    return match ? { kind: match[1], id: Number(match[2]) } : { kind: 'mine', id: null };
}

export const calendarSourceKey = (source) => (source.kind === 'mine' ? null : `${source.kind}-${source.id}`);

// Link to a shared calendar, e.g. from a session or family page
export const calendarLink = (kind, id) => `/calendar?cal=${kind}-${id}`;

const sessionUrl = (id) => `/api/shared-sessions/${id}`;

// How each kind of shared calendar is loaded and changed. Every request answers with the whole
// session / family, which then replaces what is shown.
const KINDS = {
    session: {
        load: (id) => apiFetch(sessionUrl(id)).then(normalizeSession),
        add: (id, task) => apiFetch(`${sessionUrl(id)}/tasks`, { method: 'POST', body: JSON.stringify(task) }).then(normalizeSession),
        update: (id, taskId, changes) => apiFetch(`${sessionUrl(id)}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(changes) }).then(normalizeSession),
        remove: (id, taskId) => apiFetch(`${sessionUrl(id)}/tasks/${taskId}`, { method: 'DELETE' }).then(normalizeSession),
        signal: 'session:changed',
        about: (payload, id) => Number(payload?.sessionId) === id,
    },
    family: {
        load: fetchFamily,
        add: addFamilyTask,
        update: updateFamilyTask,
        remove: removeFamilyTask,
        signal: 'family:changed',
        about: (payload, id) => Number(payload?.familyId) === id,
    },
};

// A shared calendar for the calendar page (nothing for my own: { data: null }).
// data: the session or family; tasks: its tasks, each with canRemove (who added it, or the owner);
// gone: I'm not (or no longer) in it; readOnly: an ended session.
// add / update / remove resolve when the change is saved (and shown) and reject with the API error.
export function useSharedCalendar(source) {
    const kind = KINDS[source.kind] ?? null;
    const id = source.id;
    const [state, setState] = useState({ key: null, data: null, gone: false });
    const key = kind ? `${source.kind}-${id}` : null;
    // the newest request wins, so a slow load can't undo a change that answered first
    const seq = useRef(0);

    const store = useCallback((forKey, data) => setState({ key: forKey, data, gone: false }), []);

    const load = useCallback(() => {
        if (!kind) return;
        const mine = ++seq.current;
        kind.load(id).then(
            (data) => { if (mine === seq.current) store(key, data); },
            (err) => { if (mine === seq.current && err.status === 404) setState({ key, data: null, gone: true }); },
        );
    }, [kind, id, key, store]);

    useEffect(() => { load(); }, [load]);
    useRealtimeRefresh(kind ? [kind.signal] : [], load, (event, payload) => Boolean(kind?.about(payload, id)));

    const change = (run) => async (...args) => {
        const mine = ++seq.current;
        const data = await run(...args);
        if (mine === seq.current) store(key, data);
        return data;
    };

    const current = state.key === key ? state : { data: null, gone: false };
    const data = current.data;
    const tasks = useMemo(() => (data?.tasks ?? []).map(task => ({
        ...task,
        canRemove: Boolean(data.isOwner || task.addedBy?.id === data.me),
    })), [data]);

    return {
        data,
        tasks,
        loading: Boolean(kind) && !data && !current.gone,
        gone: current.gone,
        readOnly: Boolean(data?.endedAt),
        add: change((task) => kind.add(id, task)),
        update: change((taskId, changes) => kind.update(id, taskId, changes)),
        remove: change((taskId) => kind.remove(id, taskId)),
    };
}
