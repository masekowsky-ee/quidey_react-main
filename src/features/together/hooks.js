import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSharedSession, togetherErrorText } from './togetherAction';
import { showToast } from '../toast/toast';
import { useTranslation } from '../../i18n/useTranslation';
import { useRealtime, useRealtimeRefresh, useRealtimeSession, useSafetyPoll } from '../realtime/socket';
import { SHARED_SESSION_EVENT } from './togetherActionTypes';

// An open session loads again when the server says it changed (tasks, members, who works on
// what) and gets chat messages live. Polling is only the safety net, e.g. for somebody who
// closed their laptop mid-task (the server can't announce that); the others' running time is
// counted on in the browser in between (see othersRunningMs in work.js).
export const POLL_MS = 30 * 1000;

// Loads a session and keeps it current while shown (on every change, and as a safety net every
// POLL_MS while the tab is visible, see useSafetyPoll). missing: I'm not (or no longer) a
// member, or it was deleted.
export function useSharedSession(id) {
    const dispatch = useDispatch();
    const stored = useSelector(state => state.together.current);
    const session = id && stored?.id === id ? stored : null;
    const [missingId, setMissingId] = useState(null);

    const load = useCallback(() => dispatch(fetchSharedSession(id))
        .then(() => setMissingId(null))
        .catch(err => { if (err.status === 404) setMissingId(id); }), [dispatch, id]);

    useEffect(() => { if (id) load(); }, [load, id]);
    // the safety net: every POLL_MS, while live updates arrive only every other time
    useSafetyPoll(load, { everyMs: POLL_MS, connectedEveryMs: 2 * POLL_MS, enabled: Boolean(id) });

    // the live chat, once the server let me see the session (i.e. I'm a member)
    useRealtimeSession(session ? id : null);
    useRealtime('session:event', (payload) => {
        if (payload?.sessionId === id) dispatch({ type: SHARED_SESSION_EVENT, payload });
    });
    // changes (and whatever happened while the connection was down), loaded once per burst
    useRealtimeRefresh(['session:changed'], () => { if (id) load(); }, (event, payload) => payload?.sessionId === id);

    return { session, missing: missingId === id && !session };
}

// run(action, successKey?) dispatches an action; failures are shown as a toast with a
// translated message, success optionally too. Resolves to true when it worked.
export function useTogetherRun() {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    return useCallback(async (action, successKey) => {
        try {
            await dispatch(action);
            if (successKey) dispatch(showToast(t(successKey), 'success'));
            return true;
        } catch (err) {
            dispatch(showToast(togetherErrorText(t, err), 'error'));
            return false;
        }
    }, [dispatch, t]);
}
