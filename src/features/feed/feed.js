import { useDispatch, useStore } from 'react-redux';
import { apiFetch, displayName, fill } from '../helperFunction';
import { showToast } from '../toast/toast';
import { playSound } from '../settings/sound';
import { useTranslation } from '../../i18n/useTranslation';
import { markNews } from '../realtime/news';
import { useRealtime, useRealtimeRefresh } from '../realtime/socket';
import { fetchProgress } from '../progress/progress';

// The feed on the Gemeinschaft page: what friends and I did (a day's focus, challenges, levels,
// streaks) and short posts, newest first, a page at a time. Friends cheer entries on.
// Entries: { id, kind, day, data, createdAt, updatedAt, user, mine, cheers, cheered, cheerers? }

export const FEED_POST_MAX = 280;

const FEED_LOADED = 'FEED_LOADED';
const FEED_MORE_LOADED = 'FEED_MORE_LOADED';
const FEED_FAILED = 'FEED_FAILED';
const FEED_ENTRY_ADDED = 'FEED_ENTRY_ADDED';
const FEED_ENTRY_REMOVED = 'FEED_ENTRY_REMOVED';
const FEED_ENTRY_CHEERED = 'FEED_ENTRY_CHEERED';

const initialState = { entries: [], next: null, loaded: false, failed: false };

export default function feedReducer(state = initialState, action) {
    switch (action.type) {
        case FEED_LOADED:
            return { entries: action.payload.entries, next: action.payload.next, loaded: true, failed: false };
        case FEED_MORE_LOADED: {
            const known = new Set(state.entries.map(entry => entry.id));
            return { ...state, entries: [...state.entries, ...action.payload.entries.filter(entry => !known.has(entry.id))], next: action.payload.next };
        }
        case FEED_FAILED:
            return { ...state, failed: true };
        case FEED_ENTRY_ADDED:
            return { ...state, entries: [action.payload, ...state.entries.filter(entry => entry.id !== action.payload.id)] };
        case FEED_ENTRY_REMOVED:
            return { ...state, entries: state.entries.filter(entry => entry.id !== action.payload) };
        case FEED_ENTRY_CHEERED:
            return {
                ...state,
                entries: state.entries.map(entry => entry.id === action.payload.id
                    ? { ...entry, cheers: action.payload.cheers, cheered: action.payload.cheered } : entry),
            };
        default:
            return state;
    }
}

// The first page again (what is on screen stays until it has come)
export const fetchFeed = () => async (dispatch) => {
    try {
        dispatch({ type: FEED_LOADED, payload: await apiFetch('/api/feed') });
    } catch (err) {
        dispatch({ type: FEED_FAILED });
        throw err;
    }
};

export const fetchMoreFeed = () => async (dispatch, getState) => {
    const { next } = getState().feed;
    if (!next) return;
    dispatch({ type: FEED_MORE_LOADED, payload: await apiFetch(`/api/feed?before=${encodeURIComponent(next)}`) });
};

export const postToFeed = (text) => async (dispatch) => {
    const entry = await apiFetch('/api/feed/posts', { method: 'POST', body: JSON.stringify({ text }) });
    dispatch({ type: FEED_ENTRY_ADDED, payload: entry });
    return entry;
};

export const removeFeedEntry = (id) => async (dispatch) => {
    await apiFetch(`/api/feed/${id}`, { method: 'DELETE' });
    dispatch({ type: FEED_ENTRY_REMOVED, payload: id });
};

// Cheer a friend's entry on, or take it back. Shown at once, put back if the server says no.
// Cheering counts for the "cheer friends on" challenges, so my progress is looked at again.
export const cheerFeedEntry = (entry, on) => async (dispatch) => {
    dispatch({ type: FEED_ENTRY_CHEERED, payload: { id: entry.id, cheers: Math.max(0, entry.cheers + (on ? 1 : -1)), cheered: on } });
    try {
        const result = await apiFetch(`/api/feed/${entry.id}/cheer`, { method: on ? 'PUT' : 'DELETE' });
        dispatch({ type: FEED_ENTRY_CHEERED, payload: { id: entry.id, ...result } });
        dispatch(fetchProgress()).catch(() => {});
    } catch (err) {
        dispatch({ type: FEED_ENTRY_CHEERED, payload: { id: entry.id, cheers: entry.cheers, cheered: entry.cheered } });
        throw err;
    }
};

// App-wide: when an entry of mine or a friend's comes or changes, the feed loads again if it was
// opened, and the Gemeinschaft entry gets its dot; a cheer on mine comes with a toast
export function useFeedRealtime() {
    const dispatch = useDispatch();
    const store = useStore();
    const { t } = useTranslation();

    useRealtimeRefresh(['feed:changed'], async () => {
        if (store.getState().feed.loaded) await dispatch(fetchFeed()).catch(() => {});
    });
    useRealtime('feed:changed', () => dispatch(markNews('feed')));
    useRealtime('feed:cheered', (payload) => {
        if (!payload?.user) return;
        playSound('cheer');
        dispatch(showToast(fill(t('liveFeedCheer'), { name: displayName(payload.user) }), 'info', { to: '/community' }));
    });
}
