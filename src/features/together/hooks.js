import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSharedSession, togetherErrorText } from './togetherAction';
import { showToast } from '../toast/toast';
import { useTranslation } from '../../i18n/useTranslation';

// How often an open session asks for the others' progress
export const POLL_MS = 5 * 1000;

// Loads a session and keeps it current while shown (every POLL_MS while the tab is visible,
// and when the window gets focus). missing: I'm not (or no longer) a member, or it was deleted.
export function useSharedSession(id) {
    const dispatch = useDispatch();
    const stored = useSelector(state => state.together.current);
    const session = id && stored?.id === id ? stored : null;
    const [missingId, setMissingId] = useState(null);

    useEffect(() => {
        if (!id) return;
        const load = () => dispatch(fetchSharedSession(id))
            .then(() => setMissingId(null))
            .catch(err => { if (err.status === 404) setMissingId(id); });
        load();
        const interval = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
        window.addEventListener('focus', load);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', load);
        };
    }, [dispatch, id]);

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
