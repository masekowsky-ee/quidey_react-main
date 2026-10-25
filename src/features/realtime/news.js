import { COMMUNITY_PATHS } from '../community/paths';

// "Something changed there since you last looked": a dot on a menu entry (and on the menu
// button) for the parts of the app that have no count of their own for it, e.g. a friend
// accepted my request, somebody joined or started working in one of my sessions, a friend's
// entry in the feed. All three are tabs of the Gemeinschaft page, whose menu entry shows any.
// Set from the live events (useLiveLists, useFeedRealtime), cleared by visiting the tab
// (useClearNews).

export const NEWS_SECTIONS = { social: COMMUNITY_PATHS.friends, together: COMMUNITY_PATHS.sessions, feed: COMMUNITY_PATHS.feed };

const MARK_NEWS = 'MARK_NEWS';
const CLEAR_NEWS = 'CLEAR_NEWS';
const initialState = { social: false, together: false, feed: false };

export default function newsReducer(state = initialState, action) {
    switch (action.type) {
        case MARK_NEWS:
            return state[action.payload] ? state : { ...state, [action.payload]: true };
        case CLEAR_NEWS:
            return state[action.payload] ? { ...state, [action.payload]: false } : state;
        default:
            return state;
    }
}

export const markNews = (section) => ({ type: MARK_NEWS, payload: section });
export const clearNews = (section) => ({ type: CLEAR_NEWS, payload: section });

export const selectHasNews = (state) => Object.values(state.news).some(Boolean);

// The page I'm on has nothing new for me: its dot goes away (also when news arrive while I'm there).
// The feed is the Gemeinschaft page itself, so only its own address counts for it.
export function sectionAt(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    return Object.keys(NEWS_SECTIONS).find(section => section === 'feed'
        ? path === NEWS_SECTIONS.feed
        : path === NEWS_SECTIONS[section] || path.startsWith(`${NEWS_SECTIONS[section]}/`)) ?? null;
}
