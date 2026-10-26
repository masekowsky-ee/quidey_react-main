import { COMMUNITY_PATHS, friendsPath } from '../community/paths';

// The settings, one entry per setting: [section id, text key, area]. A section's id is its
// anchor on the settings page (/settings#appearance), which opens its area and scrolls to it.
const SETTINGS = [
    ['language', 'language', 'look'],
    ['appearance', 'settingsThemeRow', 'look'],
    ['appearance', 'paletteSetting', 'look'],
    ['appearance', 'accentColor', 'look'],
    ['appearance', 'motionSetting', 'look'],
    ['appearance', 'soundSetting', 'look'],
    ['start', 'settingsLayoutRow', 'plan'],
    ['start', 'sharedTasksSetting', 'plan'],
    ['timer', 'defaultSessionLength', 'plan'],
    ['event-types', 'eventTypes', 'plan'],
    ['notifications', 'pushTitle', 'app'],
    ['notifications', 'allDayReminderTime', 'app'],
    ['install', 'installApp', 'app'],
];

// the area each settings section sits in (Settings opens it for /settings#<section>); the tour
// is found as "Einführung starten", which opens it right away
export const SECTION_AREAS = { ...Object.fromEntries(SETTINGS.map(([section, , area]) => [section, area])), tour: 'app' };

const ADMIN_TABS = { requests: 'adminRequests', users: 'adminUsers', broadcast: 'adminBroadcast', testers: 'adminTesterFeedback', overview: 'adminOverview' };

// The named parts of the pages that the command bar finds once something is typed: tabs,
// calendar views, settings and the profile's sections. `to` is the address (a tab's ?tab=, a
// section's #id), `label` a text key, `parent` the text keys of where it sits (shown beside it
// and searched too, so "Anfragen" in the inbox and among friends can be told apart).
// The admin's tabs only for admins, "Als App" only where this browser can install.
export function placeList({ isAdmin = false, installable = false } = {}) {
    const place = (to, label, parent, icon) => ({ to, label, parent, icon });
    return [
        place(COMMUNITY_PATHS.feed, 'communityTab_feed', ['community'], 'together'),
        place(COMMUNITY_PATHS.progress, 'communityTab_progress', ['community'], 'sprout'),
        place(friendsPath('add'), 'addFriend', ['communityTab_friends'], 'social'),
        place(friendsPath('requests'), 'friendRequests', ['communityTab_friends'], 'social'),
        ...['month', 'week', 'agenda'].map(view =>
            place(`/calendar?view=${view}`, `calendarView${view[0].toUpperCase()}${view.slice(1)}`, ['calendar'], 'calendar')),
        ...['overview', 'sessions', 'done'].map(tab => place(`/stats?tab=${tab}`, `statsTab_${tab}`, ['history'], 'history')),
        ...['messages', 'requests', 'notices', 'reminders'].map(tab => place(`/inbox?tab=${tab}`, `inboxTab_${tab}`, ['inbox'], 'inbox')),
        ...(isAdmin ? Object.entries(ADMIN_TABS).map(([tab, label]) => place(`/admin?tab=${tab}`, label, ['admin'], 'admin')) : []),
        ...['look', 'plan', 'app'].map(area => place(`/settings#${area}`, `settingsArea_${area}`, ['settings'], 'settings')),
        ...SETTINGS.filter(([section]) => section !== 'install' || installable)
            .map(([section, label, area]) => place(`/settings#${section}`, label, ['settings', `settingsArea_${area}`], 'settings')),
        place('/profile#account', 'account', ['profile'], 'profile'),
        place('/profile#password', 'changePassword', ['profile'], 'profile'),
        place('/profile#sign-out', 'logoutEverywhere', ['profile'], 'logout'),
        place('/profile#delete-account', 'deleteAccount', ['profile'], 'profile'),
    ];
}
