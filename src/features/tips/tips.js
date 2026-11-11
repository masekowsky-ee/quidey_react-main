// Feature tips: small tooltips at the app's own controls that say what they do (components/tips/
// FeatureTips.jsx shows them, one at a time). They took the place of the intro tour that opened by
// itself for a new account; that tour is still in Settings → App → Einführung, with "Tipps wieder
// zeigen" beside it.
// Which ones I have seen is kept with the account (users.tips_seen / tips_off, migration 047;
// `tipsSeen` / `tipsOff` from /api/me, POST /api/users/tips/seen, PUT and DELETE /api/users/tips),
// so every device knows. Who had seen the old tour has BASIC_TIPS marked seen by the migration:
// they only get the tips about what came after it. A tip added later is in nobody's list, so
// everybody sees it once: give every new feature a tip here (and its texts tip_<id>_title/_text).
import { useSelector, shallowEqual } from 'react-redux';
import { apiFetch } from '../helperFunction';
import { TIPS_SET } from '../auth/authActionTypes';
import { isCommunityPath } from '../community/paths';

const isPath = (base) => (pathname) => pathname === base || pathname.startsWith(`${base}/`);
const anyPage = () => true;

// In the order they are shown. page: where it may show; target: a CSS selector list, the first
// visible match is pointed at; a tip whose control isn't on the screen (another width, a tester
// feature, a form that isn't open) waits for it.
export const TIPS = [
    // the navigation first, on whatever page the app opens: the tab bar (phones) or the header's tabs
    { id: 'navHome', page: anyPage, target: '[data-tip="nav-home"]' },
    { id: 'navCalendar', page: anyPage, target: '[data-tip="nav-calendar"]' },
    { id: 'navFocus', page: anyPage, target: '[data-tip="nav-focus"]' },
    { id: 'navStudy', page: anyPage, target: '[data-tip="nav-study"]' },
    { id: 'navCommunity', page: anyPage, target: '[data-tip="nav-community"]' },
    { id: 'navInbox', page: anyPage, target: '[data-tip="nav-inbox"]' },
    { id: 'navStats', page: anyPage, target: '[data-tip="nav-stats"]' },
    { id: 'navMore', page: anyPage, target: '[data-tip="nav-more"]' },
    // phones with Lernen in the tab bar: Sozial moved behind "Mehr"
    { id: 'navMoreSocial', page: anyPage, target: '[data-tip="nav-more"][data-holds-social]' },
    { id: 'tabbar', page: anyPage, target: '[data-tip="tabbar"]' },
    // pages
    { id: 'add', page: (p) => p === '/', target: '[data-part="add-fab"]' },
    { id: 'focus', page: (p) => p === '/', target: '[data-part="home-focus"], [data-part="focus"]' },
    { id: 'list', page: (p) => p === '/', target: '[data-part="home-list"], [data-part="task-list"]' },
    { id: 'search', page: (p) => p === '/', target: '[data-tip="search"]' },
    { id: 'calendarViews', page: isPath('/calendar'), target: '[data-tip="calendar-views"]' },
    { id: 'calendarDrag', page: isPath('/calendar'), target: '[data-tip="calendar-grid"]' },
    { id: 'focusGoal', page: isPath('/focus'), target: '[data-tip="focus-goal"]' },
    { id: 'focusTimer', page: isPath('/focus'), target: '[data-tip="focus-timer"]' },
    { id: 'focusNotes', page: isPath('/focus'), target: '[data-tip="focus-notes"]' },
    { id: 'focusSettings', page: isPath('/focus'), target: '[data-tip="focus-settings"]' },
    { id: 'studyGoal', page: (p) => p === '/study', target: '[data-tip="study-new-goal"]' },
    { id: 'studySubject', page: (p) => p === '/study', target: '[data-tip="study-new-subject"]' },
    { id: 'studyGrades', page: (p) => p === '/study', target: '[data-tip="study-grades"]' },
    { id: 'homeworkSuggestions', page: (p) => p === '/study', target: '[data-tip="homework-suggestions"]' },
    { id: 'notesNew', page: isPath('/notes'), target: '[data-tip="notes-new"]' },
    { id: 'notesFolder', page: isPath('/notes'), target: '[data-tip="notes-folder"]' },
    { id: 'notesSearch', page: isPath('/notes'), target: '[data-tip="notes-search"]' },
    { id: 'routines', page: isPath('/routines'), target: '[data-tip="routine-new"]' },
    { id: 'collections', page: isPath('/collections'), target: '[data-tip="collection-new"]' },
    { id: 'community', page: isCommunityPath, target: '[data-tip="community-tabs"]' },
    { id: 'stats', page: isPath('/stats'), target: '[data-tip="stats-tabs"]' },
    { id: 'statsPeriod', page: isPath('/stats'), target: '[data-tip="stats-period"]' },
    { id: 'avatar', page: isPath('/profile'), target: '[data-tip="avatar-upload"]' },
    // wherever they turn up: in the drawer, in forms and sheets, on session and family pages
    // phones: Statistiken lives in the drawer
    { id: 'menuStats', page: anyPage, target: '[data-tip="menu-stats"]' },
    { id: 'menuNotes', page: anyPage, target: '[data-tip="menu-notes"]' },
    { id: 'menuRoutines', page: anyPage, target: '[data-tip="menu-routines"]' },
    { id: 'menuCollections', page: anyPage, target: '[data-tip="menu-collections"]' },
    { id: 'menuArcade', page: anyPage, target: '[data-tip="menu-arcade"]' },
    { id: 'reminders', page: anyPage, target: '[data-tip="kind-reminder"]' },
    { id: 'colorAdd', page: anyPage, target: '[data-tip="color-add"]' },
    { id: 'planMove', page: anyPage, target: '[data-tip="plan-session"]' },
    { id: 'subGroups', page: anyPage, target: '[data-part="sub-groups"]' },
    { id: 'boards', page: anyPage, target: '[data-part="note-board"]' },
];

// What the old intro tour already showed: marked seen by migration 047 for everybody who had seen
// it. Keep in step with the list in the backend's migrations/047_feature_tips.sql.
export const BASIC_TIPS = [
    'navHome', 'navCalendar', 'navFocus', 'navCommunity', 'navInbox', 'navStats', 'navMore', 'tabbar',
    'add', 'focus', 'list', 'search', 'calendarViews', 'calendarDrag', 'focusTimer', 'community', 'stats',
];

export const tipsForPage = (pathname) => TIPS.filter(tip => tip.page(pathname));

// { ready: the server has answered, seen: [id], off }
export const selectTips = (state) => ({
    ready: state.auth.access.checked,
    seen: state.auth.access.tipsSeen ?? [],
    off: Boolean(state.auth.access.tipsOff),
});
export const useTips = () => useSelector(selectTips, shallowEqual);

const set = (seen, off) => ({ type: TIPS_SET, payload: { seen, off } });
// the server's list joined with what is seen here meanwhile: answers coming back out of order
// never bring a tip back
const fromServer = (dispatch, getState) => (answer) => {
    if (answer && Array.isArray(answer.tipsSeen)) {
        const here = selectTips(getState()).seen;
        dispatch(set([...here, ...answer.tipsSeen.filter(id => !here.includes(id))], Boolean(answer.tipsOff)));
    }
    return answer;
};

// A copy on this device too (localStorage `tips:<username>` = { seen: [id], off }): a tip seen while
// the server couldn't be reached (offline, an older server) doesn't come back on the next start, and
// is sent then (syncTips).
const LOCAL_MAX = 300;
const localKey = (getState) => {
    const username = getState().auth.user?.username;
    return username ? `tips:${username}` : null;
};
function readLocal(getState) {
    const key = localKey(getState);
    try {
        const value = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
        return {
            seen: Array.isArray(value?.seen) ? value.seen.filter(id => typeof id === 'string') : [],
            off: value?.off === true,
        };
    } catch {
        return { seen: [], off: false };
    }
}
function writeLocal(getState, value) {
    const key = localKey(getState);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify({ seen: value.seen.slice(-LOCAL_MAX), off: value.off }));
    } catch { /* full or blocked: the server's list still counts */ }
}

// Once the server has answered (/api/me): what this device saw that the server doesn't know yet is
// joined in and sent along. FeatureTips runs it when it starts.
export const syncTips = () => (dispatch, getState) => {
    const server = selectTips(getState());
    if (!server.ready) return Promise.resolve();
    const local = readLocal(getState);
    const missing = local.seen.filter(id => !server.seen.includes(id));
    const off = server.off || local.off;
    if (missing.length === 0 && off === server.off) return Promise.resolve();
    dispatch(set([...server.seen, ...missing], off));
    const sends = [];
    if (missing.length > 0) {
        sends.push(apiFetch('/api/users/tips/seen', { method: 'POST', body: JSON.stringify({ ids: missing.slice(0, 50) }) })
            .then(fromServer(dispatch, getState)).catch(() => {}));
    }
    if (off && !server.off) {
        sends.push(apiFetch('/api/users/tips', { method: 'PUT', body: JSON.stringify({ off: true }) })
            .then(fromServer(dispatch, getState)).catch(() => {}));
    }
    return Promise.all(sends);
};

// Seen at once, here and on this device; the server adds it to the account's list.
export const markTipSeen = (id) => (dispatch, getState) => {
    const { seen, off } = selectTips(getState());
    if (seen.includes(id)) return Promise.resolve();
    dispatch(set([...seen, id], off));
    const local = readLocal(getState);
    if (!local.seen.includes(id)) writeLocal(getState, { ...local, seen: [...local.seen, id] });
    return apiFetch('/api/users/tips/seen', { method: 'POST', body: JSON.stringify({ ids: [id] }) })
        .then(fromServer(dispatch, getState)).catch(() => {});
};

// "Tipps ausblenden"
export const turnTipsOff = () => (dispatch, getState) => {
    dispatch(set(selectTips(getState()).seen, true));
    writeLocal(getState, { ...readLocal(getState), off: true });
    return apiFetch('/api/users/tips', { method: 'PUT', body: JSON.stringify({ off: true }) })
        .then(fromServer(dispatch, getState)).catch(() => {});
};

// Settings → "Tipps wieder zeigen": every tip once more. Rejects when the server can't be reached.
export const resetTips = () => async (dispatch, getState) => {
    const answer = await apiFetch('/api/users/tips', { method: 'DELETE' });
    writeLocal(getState, { seen: [], off: false });
    dispatch(set(answer?.tipsSeen ?? [], Boolean(answer?.tipsOff)));
    return answer;
};
