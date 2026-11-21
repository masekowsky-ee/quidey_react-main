import { useEffect, useRef } from 'react';
import { apiBase } from '../api/transport';
import { session } from '../api/session';
import { REALTIME_RECONNECT, REALTIME_REJECTED, SESSION_JOIN, SESSION_LEAVE } from './events';

// The live connection to the backend (Socket.IO): new direct messages, the shared sessions'
// chat and the team's notices arrive right away. App connects while signed in with access and
// disconnects on sign-out. Components listen with useRealtime(event, handler); that works
// before a connection exists (and in tests, where there is none), the handler just isn't called.
//
// Events from the server: message:new, inbox:read, notification:new, session:event, and the
// "load it again" signals session:changed, invites:changed, friends:changed, tasks:changed
// (see realtime.js in the backend). Polling stays only as a slow safety net.
// REALTIME_RECONNECT fires after the connection came back, so pages load what they missed.

// (the names are in ./events.js)
export { REALTIME_RECONNECT, REALTIME_REJECTED };

let socket = null;
// bumped on every connect/disconnect, so a client library that arrives late isn't used any more
let generation = 0;
const listeners = new Map();   // event -> Set of handlers
const sessions = new Map();    // shared session id -> number of pages following it

function notify(event, payload) {
    for (const handler of listeners.get(event) ?? []) handler(payload);
}

// Adds a handler for an event; answers the function that takes it away again
function subscribe(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event).delete(handler);
}

function joinSession(id) {
    socket?.emit(SESSION_JOIN, id);
}

// Whether live updates arrive right now (then the safety-net polling can rest)
const isRealtimeConnected = () => Boolean(socket?.connected);

// Production builds talk to VITE_API_URL; locally Vite's proxy forwards /socket.io.
// The client library is loaded only now, so the sign-in screen doesn't carry it.
// Resolves once the socket exists (not necessarily connected yet).
export async function connectRealtime() {
    if (socket) return;
    const mine = ++generation;
    const { io } = await import('socket.io-client');
    // signed out (or connected again) while the library was on its way
    if (mine !== generation || socket) return;
    socket = io(apiBase() || undefined, {
        // read on every (re)connect, so a new token (password changed) is used right away
        auth: (cb) => cb({ token: session.token() }),
    });
    let connectedBefore = false;
    socket.on('connect', () => {
        for (const id of sessions.keys()) joinSession(id);
        if (connectedBefore) notify(REALTIME_RECONNECT);
        connectedBefore = true;
    });
    // the server closes the sockets when the login changes (new password, signed out everywhere,
    // pro taken away); with a token that still works it lets us in again
    socket.on('disconnect', (reason) => {
        if (reason !== 'io server disconnect') return;
        const current = socket;
        setTimeout(() => { if (socket === current && session.token()) current.connect(); }, 1000);
    });
    // turned away by the server: App checks the access again (pro taken away, signed out)
    socket.on('connect_error', (err) => { if (err?.message === 'UNAUTHORIZED') notify(REALTIME_REJECTED); });
    socket.onAny(notify);
}

export function disconnectRealtime() {
    generation++;
    socket?.disconnect();
    socket = null;
}

// The safety net for whatever the live connection could miss: run() every `everyMs` while the
// tab is visible, but only every `connectedEveryMs` while live updates arrive (they already
// keep the data current); when the window gets focus only while not connected (after a
// reconnect the pages load again by themselves). Nothing while `enabled` is false.
export function useSafetyPoll(run, { everyMs, connectedEveryMs = everyMs * 5, enabled = true, immediately = false }) {
    const latest = useRef(run);
    useEffect(() => { latest.current = run; });
    useEffect(() => {
        if (!enabled) return;
        let last = Date.now();
        const go = () => { last = Date.now(); latest.current(); };
        const tick = () => {
            if (document.hidden) return;
            if (isRealtimeConnected() && Date.now() - last < connectedEveryMs) return;
            go();
        };
        const onFocus = () => { if (!isRealtimeConnected()) go(); };
        if (immediately) go();
        const interval = setInterval(tick, everyMs);
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [enabled, everyMs, connectedEveryMs, immediately]);
}

// Calls handler(payload) for every `event` from the server while the component is mounted
export function useRealtime(event, handler) {
    const latest = useRef(handler);
    useEffect(() => { latest.current = handler; });
    useEffect(() => {
        return subscribe(event, (payload) => latest.current(payload));
    }, [event]);
}

// Calls refresh() once shortly after any of `events` (and after a reconnect), however many
// arrive at once: five changes in a row load the data once, not five times.
// accept(event, payload) can skip events that aren't about this data.
export const REFRESH_DELAY_MS = 300;
export function useRealtimeRefresh(events, refresh, accept = () => true) {
    const latest = useRef({ refresh, accept });
    useEffect(() => { latest.current = { refresh, accept }; });
    const key = events.join(' ');
    useEffect(() => {
        let timer = null;
        const unsubscribe = [...key.split(' '), REALTIME_RECONNECT].map(event => subscribe(event, (payload) => {
            if (event !== REALTIME_RECONNECT && !latest.current.accept(event, payload)) return;
            clearTimeout(timer);
            timer = setTimeout(() => latest.current.refresh(), REFRESH_DELAY_MS);
        }));
        return () => {
            clearTimeout(timer);
            for (const off of unsubscribe) off();
        };
    }, [key]);
}

// Follows a shared session's chat while the component is mounted (members only, checked by the server)
export function useRealtimeSession(sessionId) {
    useEffect(() => {
        if (!sessionId) return;
        sessions.set(sessionId, (sessions.get(sessionId) ?? 0) + 1);
        if (socket?.connected) joinSession(sessionId);
        return () => {
            const left = sessions.get(sessionId) - 1;
            if (left > 0) return sessions.set(sessionId, left);
            sessions.delete(sessionId);
            socket?.emit(SESSION_LEAVE, sessionId);
        };
    }, [sessionId]);
}
