import { COMMUNITY_PATHS } from '../community/paths.js';

// The main navigation destinations, once: where they go, their icon (a name from components/Icon,
// not a component, so this file stays light), their label (an i18n key) and the "G then ..."
// shortcut. The menu, tab bar, top bar, command bar, shortcuts, tab swipe and add button each
// pick from this by id; their order lives in the named lists below. Every path is a ROUTES path
// (routeTable.js; the community one is COMMUNITY_PATHS.feed), a test checks that.
export const NAV = {
    home: { path: '/', icon: 'home', label: 'home', guest: true, go: { key: 'h', label: 'shortcut_goHome' } },
    calendar: { path: '/calendar', icon: 'calendar', label: 'calendar', guest: true, go: { key: 'k', label: 'shortcut_goCalendar' } },
    // the tab bar says "Fokus", everywhere else it is the "Fokusraum"
    focus: { path: '/focus', icon: 'focus', label: 'focusRoom', tabLabel: 'focusTab', guest: true, go: { key: 'f', label: 'shortcut_goFocus' } },
    routines: { path: '/routines', icon: 'routine', label: 'routines', go: { key: 'r', label: 'shortcut_goRoutines' } },
    notes: { path: '/notes', icon: 'note', label: 'notesTitle' },
    collections: { path: '/collections', icon: 'collection', label: 'collections' },
    study: { path: '/study', icon: 'book', label: 'studyNav' },
    community: { path: COMMUNITY_PATHS.feed, icon: 'together', label: 'community', go: { key: 'g', label: 'shortcut_goCommunity' } },
    inbox: { path: '/inbox', icon: 'inbox', label: 'inbox', go: { key: 'p', label: 'shortcut_goInbox' } },
    stats: { path: '/stats', icon: 'history', label: 'history', go: { key: 's', label: 'shortcut_goStats' } },
    arcade: { path: '/arcade', icon: 'gamepad', label: 'arcade' },
    profile: { path: '/profile', icon: 'profile', label: 'profile' },
    settings: { path: '/settings', icon: 'settings', label: 'settings' },
    feedback: { path: '/feedback', icon: 'feedback', label: 'feedback' },
    tester: { path: '/tester', icon: 'flask', label: 'testerNav' },
    admin: { path: '/admin', icon: 'admin', label: 'admin' },
};

// path constants for Link / navigate: paths.focus instead of the literal '/focus'
export const paths = Object.fromEntries(Object.entries(NAV).map(([id, entry]) => [id, entry.path]));

// the phone tab bar and the swipe between pages: three fixed tabs, then Lernen or Sozial
export const TAB_IDS = ['home', 'calendar', 'focus'];
export const tabIds = (study = false) => [...TAB_IDS, study ? 'study' : 'community'];

// the pages with the round add button that are plain nav destinations (the rest are patterns)
export const FAB_IDS = ['home', 'calendar', 'focus'];

// "G, then a key": the destinations that have one, in the order the shortcut overview lists them
export const GO_IDS = ['home', 'calendar', 'focus', 'routines', 'community', 'inbox', 'stats'];
