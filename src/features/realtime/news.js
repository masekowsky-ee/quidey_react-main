// "Something changed there since you last looked": a dot on a menu entry (and on the menu
// button) for the parts of the app that have no count of their own for it, e.g. a friend
// accepted my request, somebody joined or started working in one of my sessions.
// Set from the live events (useLiveLists), cleared by visiting the page (useClearNews).

export const NEWS_SECTIONS = { social: '/social', together: '/together' };

const MARK_NEWS = 'MARK_NEWS';
const CLEAR_NEWS = 'CLEAR_NEWS';
const initialState = { social: false, together: false };

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

// The page I'm on has nothing new for me: its dot goes away (also when news arrive while I'm there)
export function sectionAt(pathname) {
    return Object.keys(NEWS_SECTIONS).find(section =>
        pathname === NEWS_SECTIONS[section] || pathname.startsWith(`${NEWS_SECTIONS[section]}/`)) ?? null;
}
